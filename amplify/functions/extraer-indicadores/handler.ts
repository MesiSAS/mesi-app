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
const CLAVES = ['ingresos', 'costos', 'cartera_total', 'cartera_vencida', 'recaudo', 'caja_operativa', 'dividendos', 'saldo_bancos'] as const;
const UNIDAD: Record<string, string> = {
  ingresos: 'COP', costos: 'COP', cartera_total: 'COP', cartera_vencida: 'COP', recaudo: 'COP',
  caja_operativa: 'COP', dividendos: 'COP', saldo_bancos: 'COP',
};
// Descripción de cada clave para que el LLM la reconozca en el texto.
const CLAVE_DESC: Record<string, string> = {
  ingresos: 'ingresos / ventas del periodo',
  costos: 'costos y/o gastos del periodo',
  cartera_total: 'cartera total (cuentas por cobrar)',
  cartera_vencida: 'cartera vencida en COP',
  recaudo: 'recaudo / cobros del periodo',
  caja_operativa: 'generación de caja operativa (documento de Tesorería / presentación de caja)',
  dividendos: 'dividendos entregados a socios (Tesorería, "dividendos socios")',
  saldo_bancos: 'saldo en bancos a fin de mes (Tesorería, "saldo banco fin de mes")',
};

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c instanceof Buffer ? c : Buffer.from(c));
  return Buffer.concat(chunks);
};

// ---- Parser determinístico del Excel de personal (headcount / entradas / salidas) ----
// Formato: hoja con bloques "Indicadores de personal · EMPRESA · AAAA", seguidos de
// una fila "Indicador | Enero | Febrero | ..." y filas Headcount / Entradas / Salidas.
// Un solo archivo trae TODAS las empresas y TODOS los meses.
const norm = (s: any) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const MESES_NUM: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};
const LABEL_CLAVE: Record<string, string> = {
  headcount: 'headcount', entradasdepersonal: 'entradas', salidasdepersonal: 'salidas',
};
type FilaPersonal = { empresaRaw: string; anio: string; mes: string; clave: string; valor: number };

const parsearPersonalExcel = (buffer: Buffer): FilaPersonal[] => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const out: FilaPersonal[] = [];
  for (const sheetName of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    for (let i = 0; i < aoa.length; i++) {
      const first = (aoa[i]?.[0] ?? '').toString();
      const m = first.match(/indicadores de personal\s*·\s*(.+?)\s*·\s*(\d{4})/i);
      if (!m) continue;
      const empresaRaw = m[1].trim(), anio = m[2];
      // Fila de encabezado "Indicador | Enero | ..." dentro de las siguientes filas.
      let hdr = -1;
      for (let k = i + 1; k < Math.min(i + 5, aoa.length); k++) { if (norm(aoa[k]?.[0]) === 'indicador') { hdr = k; break; } }
      if (hdr < 0) continue;
      const monthCols: Array<[number, string]> = [];
      const hrow = aoa[hdr];
      for (let c = 1; c < hrow.length; c++) { const mm = MESES_NUM[norm(hrow[c])]; if (mm) monthCols.push([c, mm]); }
      for (let r = hdr + 1; r < aoa.length; r++) {
        const lbl = norm(aoa[r]?.[0]);
        if (!lbl) break;                                  // fila en blanco = fin del bloque
        if (lbl.startsWith('indicadoresdepersonal')) break; // empieza otro bloque
        const clave = LABEL_CLAVE[lbl];
        if (!clave) continue;
        for (const [c, mm] of monthCols) {
          const v = aoa[r][c];
          if (typeof v === 'number' && isFinite(v)) out.push({ empresaRaw, anio, mes: mm, clave, valor: v });
        }
      }
    }
  }
  return out;
};

// Empareja el nombre del bloque con una empresa registrada (tolerante a mayúsculas,
// acentos y sufijos: "4G Energia - Comercializadora" → "4G Energía").
const matchEmpresa = (raw: string, empresas: Array<{ nombre: string }>): string | null => {
  const r = norm(raw);
  if (!r) return null;
  let best: string | null = null, bestLen = 0;
  for (const e of empresas) {
    const n = norm(e.nombre);
    if (!n) continue;
    if (n === r || n.startsWith(r) || r.startsWith(n)) {
      if (n.length > bestLen) { best = e.nombre; bestLen = n.length; }
    }
  }
  return best;
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
    `Claves permitidas (usa exactamente estos nombres):`,
    ...CLAVES.map((c) => `- ${c}: ${CLAVE_DESC[c]}`),
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

    const leerBuffer = async (a: any): Promise<Buffer> => {
      const obj = await s3.send(new GetObjectCommand({ Bucket: env.BUCKET_NAME, Key: a.s3Key }));
      return streamToBuffer(obj.Body);
    };
    const leerTexto = async (a: any): Promise<string> => extractText(await leerBuffer(a), a.nombre || '', a.tipo);

    // ---- Camino 1: Excel de personal (headcount/entradas/salidas, multi-empresa) ----
    const extPrimario = (archivo.nombre || '').split('.').pop()?.toLowerCase() || '';
    if (['xlsx', 'xls', 'xlsm'].includes(extPrimario)) {
      const bufferXlsx = await leerBuffer(archivo);
      const filas = parsearPersonalExcel(bufferXlsx);
      if (filas.length) {
        const empresasRes = await client.models.Empresa.list({ limit: 1000 });
        const empresas = (empresasRes.data || []).filter(Boolean) as Array<{ nombre: string }>;
        // Resolver nombre de empresa por bloque (cachear match por empresaRaw).
        const matchCache = new Map<string, string | null>();
        const resolver = (raw: string) => { if (!matchCache.has(raw)) matchCache.set(raw, matchEmpresa(raw, empresas)); return matchCache.get(raw) || null; };

        // Indicadores existentes de las empresas emparejadas, para upsert por (empresa,anio,mes,clave).
        const nombresMatch = [...new Set(filas.map((f) => resolver(f.empresaRaw)).filter(Boolean) as string[])];
        const existentesPorEmpresa = new Map<string, any[]>();
        for (const nombre of nombresMatch) {
          const r = await client.models.IndicadorEmpresa.list({ filter: { empresa: { eq: nombre } }, limit: 1000 });
          existentesPorEmpresa.set(nombre, r.data || []);
        }

        const PERSONAL_UNIDAD = 'num';
        const noMatch = new Set<string>();
        let creados = 0, actualizados = 0;
        const ops: Array<Promise<any>> = [];
        for (const f of filas) {
          const empresa = resolver(f.empresaRaw);
          if (!empresa) { noMatch.add(f.empresaRaw); continue; }
          const existentes = existentesPorEmpresa.get(empresa) || [];
          const prev = existentes.find((e) => e.anio === f.anio && e.mes === f.mes && e.clave === f.clave);
          const datos = {
            empresa, anio: f.anio, mes: f.mes, clave: f.clave,
            valor: f.valor, unidad: PERSONAL_UNIDAD,
            fuente: 'excel', fuenteArchivoId: archivo.id, estado: 'confirmado',
            actualizado: new Date().toISOString(),
          };
          if (prev) { ops.push(client.models.IndicadorEmpresa.update({ id: prev.id, ...datos })); actualizados += 1; }
          else { ops.push(client.models.IndicadorEmpresa.create(datos)); creados += 1; }
          // Evitar duplicados dentro de la misma corrida (p.ej. clave repetida).
          if (!prev) existentes.push({ id: '__nuevo__', anio: f.anio, mes: f.mes, clave: f.clave });
        }
        // Ejecutar en lotes para no exceder límites.
        const CHUNK = 20;
        for (let i = 0; i < ops.length; i += CHUNK) await Promise.all(ops.slice(i, i + CHUNK));

        const empresasOk = nombresMatch.join(', ');
        const aviso = noMatch.size ? ` (sin empresa registrada: ${[...noMatch].join(', ')})` : '';
        return {
          creados, actualizados, claves: 'headcount, entradas, salidas',
          mensaje: `Personal importado: ${creados + actualizados} valores de ${nombresMatch.length} empresa(s) [${empresasOk}].${aviso}`,
        };
      }
      // Si no es el formato de personal, sigue al camino de texto/LLM normal.
    }

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
