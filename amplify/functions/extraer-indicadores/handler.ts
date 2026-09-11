import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import type { Schema } from '../../data/resource';

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

const env = process.env as Record<string, string>;
const textDecoder = new TextDecoder();
const bedrock = new BedrockRuntimeClient({ region: env.AWS_REGION });
const s3 = new S3Client({ region: env.AWS_REGION });

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as unknown as DataClientEnv
);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

// Claves estandar del dashboard. Todas en COP (valores) para poder consolidar
// entre empresas; los porcentajes (margen, % vencida) se derivan en el dashboard.
const CLAVES = ['ingresos', 'costos', 'cartera_total', 'cartera_vencida', 'recaudo'] as const;
const UNIDAD: Record<string, string> = {
  ingresos: 'COP', costos: 'COP', cartera_total: 'COP', cartera_vencida: 'COP', recaudo: 'COP',
};

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c instanceof Buffer ? c : Buffer.from(c));
  return Buffer.concat(chunks);
};

const extractText = async (buffer: Buffer, nombre: string, tipo?: string | null): Promise<string> => {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  const mime = (tipo || '').toLowerCase();
  try {
    if (ext === 'pdf' || mime.includes('pdf')) return (await pdfParse(buffer)).text || '';
    if (ext === 'docx' || mime.includes('wordprocessingml')) return (await mammoth.extractRawText({ buffer })).value || '';
    if (['xlsx', 'xls', 'xlsm'].includes(ext) || mime.includes('spreadsheetml') || mime.includes('ms-excel')) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      return wb.SheetNames.map((h) => `# ${h}\n${XLSX.utils.sheet_to_csv(wb.Sheets[h])}`).join('\n\n');
    }
    if (['txt', 'csv', 'md'].includes(ext) || mime.startsWith('text/')) return buffer.toString('utf-8');
  } catch (e) {
    console.error('ERROR EXTRAYENDO TEXTO:', nombre, e);
  }
  return '';
};

const parseJsonBlock = (raw: string): any => {
  const m = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/(\{[\s\S]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
};

const extraerConIA = async (texto: string, empresa: string, anio: string, mes: string) => {
  const system = [
    'Eres un extractor de indicadores financieros de documentos empresariales.',
    'Del texto que recibes, extrae UNICAMENTE los indicadores que aparezcan EXPLICITAMENTE para el periodo indicado.',
    'Devuelve SOLO un bloque JSON: {"indicadores":[{"clave":"...","valor":<numero>}]}',
    `Claves permitidas (usa exactamente estos nombres): ${CLAVES.join(', ')}.`,
    'Todos los valores en COP (pesos), sin separadores de miles y con punto decimal.',
    'cartera_vencida = valor EN COP de la cartera vencida; si el informe solo da el porcentaje vencido y la cartera total, multiplica para obtener el valor.',
    'Si un indicador NO aparece claramente, NO lo incluyas. NUNCA inventes cifras.',
  ].join('\n');
  const prompt = [
    `Empresa: ${empresa} | Periodo: ${mes}/${anio}`,
    '',
    'Texto del documento:',
    texto.slice(0, 16000),
    '',
    'Indicadores encontrados (JSON):',
  ].join('\n');

  const resp = await bedrock.send(new InvokeModelCommand({
    modelId: env.BEDROCK_CHAT_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 600,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  }));
  const payload = JSON.parse(textDecoder.decode(resp.body)) as { content?: Array<{ text?: string }> };
  const raw = payload.content?.map((c) => c.text || '').join('\n') || '';
  const parsed = parseJsonBlock(raw);
  const items = Array.isArray(parsed?.indicadores) ? parsed.indicadores : [];
  return items
    .filter((it: any) => it && CLAVES.includes(it.clave) && typeof it.valor === 'number' && isFinite(it.valor))
    .map((it: any) => ({ clave: it.clave as string, valor: it.valor as number }));
};

export const handler: Schema['extraerIndicadores']['functionHandler'] = async (event) => {
  const { archivoId } = event.arguments;
  try {
    const res = await client.models.Archivo.get({ id: archivoId });
    const archivo = res.data;
    if (!archivo?.s3Key) return { creados: 0, actualizados: 0, claves: '', mensaje: 'Archivo no encontrado.' };
    if (!archivo.anio || !archivo.mes) {
      return { creados: 0, actualizados: 0, claves: '', mensaje: 'El archivo no tiene año/mes; no se puede ubicar el periodo.' };
    }

    const leerTexto = async (a: any): Promise<string> => {
      const obj = await s3.send(new GetObjectCommand({ Bucket: env.BUCKET_NAME, Key: a.s3Key }));
      const buffer = await streamToBuffer(obj.Body);
      return extractText(buffer, a.nombre || '', a.tipo);
    };

    let texto = await leerTexto(archivo);
    let fuenteArchivo = archivo;

    // Fallback: si el PDF (u otro) no dio texto, buscar un hermano editable
    // (mismo empresa/modulo/anio/mes) y extraer de ese — preferir el de nombre similar.
    if (!texto.trim()) {
      const baseNombre = (archivo.nombre || '').replace(/\.[^.]+$/, '').toLowerCase();
      const hermanosRes = await client.models.Archivo.list({
        filter: {
          and: [
            { empresa: { eq: archivo.empresa || '' } },
            { modulo: { eq: archivo.modulo || '' } },
            { anio: { eq: archivo.anio || '' } },
            { mes: { eq: archivo.mes || '' } },
          ],
        },
        limit: 200,
      });
      const editables = (hermanosRes.data || []).filter((h) => {
        if (!h || h.id === archivo.id || !h.s3Key) return false;
        const ext = (h.nombre || '').split('.').pop()?.toLowerCase();
        return ['docx', 'doc', 'xlsx', 'xls', 'xlsm', 'txt', 'csv'].includes(ext || '');
      });
      // Preferir el que tenga el mismo nombre base.
      editables.sort((a, b) => {
        const am = (a.nombre || '').replace(/\.[^.]+$/, '').toLowerCase() === baseNombre ? 0 : 1;
        const bm = (b.nombre || '').replace(/\.[^.]+$/, '').toLowerCase() === baseNombre ? 0 : 1;
        return am - bm;
      });
      for (const h of editables) {
        const t = await leerTexto(h);
        if (t.trim()) { texto = t; fuenteArchivo = h; break; }
      }
    }

    if (!texto.trim()) {
      return { creados: 0, actualizados: 0, claves: '', mensaje: 'Sin texto extraible (ni en el archivo ni en un editable equivalente del mismo periodo).' };
    }

    const empresa = archivo.empresa || '';
    const indicadores = await extraerConIA(texto, empresa, archivo.anio, archivo.mes);
    if (!indicadores.length) {
      return { creados: 0, actualizados: 0, claves: '', mensaje: 'No se encontraron indicadores en el documento.' };
    }

    // Upsert por (empresa, anio, mes, clave). Reusa existentes de este archivo.
    const existentesRes = await client.models.IndicadorEmpresa.list({
      filter: {
        and: [
          { empresa: { eq: empresa } },
          { anio: { eq: archivo.anio } },
          { mes: { eq: archivo.mes } },
        ],
      },
      limit: 1000,
    });
    const existentes = existentesRes.data || [];

    let creados = 0, actualizados = 0;
    for (const ind of indicadores) {
      const prev = existentes.find((e) => e.clave === ind.clave);
      const datos = {
        empresa, anio: archivo.anio || '', mes: archivo.mes || '', clave: ind.clave,
        valor: ind.valor, unidad: UNIDAD[ind.clave] || '',
        fuente: 'pdf', fuenteArchivoId: fuenteArchivo.id, estado: 'por_confirmar',
        actualizado: new Date().toISOString(),
      };
      if (prev) { await client.models.IndicadorEmpresa.update({ id: prev.id, ...datos }); actualizados += 1; }
      else { await client.models.IndicadorEmpresa.create(datos); creados += 1; }
    }

    const claves = indicadores.map((i: { clave: string }) => i.clave).join(', ');
    return { creados, actualizados, claves, mensaje: `Extraídos ${indicadores.length} indicador(es): ${claves}. Revisa y confirma.` };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    console.error('ERROR EXTRAYENDO INDICADORES:', err?.name, err?.message);
    return { creados: 0, actualizados: 0, claves: '', mensaje: `Error: ${err?.name || ''} ${err?.message || String(error)}` };
  }
};
