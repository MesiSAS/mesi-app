import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
// pdf-parse expone codigo de debug en su index; importamos el lib directo.
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

const parseJson = <T>(bytes?: Uint8Array): T => {
  if (!bytes) return {} as T;
  return JSON.parse(textDecoder.decode(bytes)) as T;
};

const embed = async (text: string): Promise<number[]> => {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: env.BEDROCK_EMBEDDING_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text.slice(0, 8000) }),
  }));
  const payload = parseJson<{ embedding?: number[] }>(response.body);
  return payload.embedding || [];
};

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const extractText = async (
  buffer: Buffer,
  nombre: string,
  tipo?: string | null
): Promise<string> => {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  const mime = (tipo || '').toLowerCase();

  try {
    if (ext === 'pdf' || mime.includes('pdf')) {
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (['xlsx', 'xls', 'xlsm'].includes(ext) || mime.includes('spreadsheetml') || mime.includes('ms-excel')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      return workbook.SheetNames
        .map((nombreHoja) => {
          const hoja = workbook.Sheets[nombreHoja];
          return `# ${nombreHoja}\n${XLSX.utils.sheet_to_csv(hoja)}`;
        })
        .join('\n\n');
    }

    if (['txt', 'csv', 'md', 'json', 'log'].includes(ext) || mime.startsWith('text/')) {
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error('ERROR EXTRAYENDO TEXTO:', nombre, error);
    return '';
  }

  // Tipo no soportado (sin OCR): se omite el contenido.
  return '';
};

const chunkText = (text: string, size = 1000, overlap = 150): string[] => {
  const limpio = text.replace(/\s+/g, ' ').trim();
  if (!limpio) return [];

  const chunks: string[] = [];
  let inicio = 0;
  while (inicio < limpio.length) {
    chunks.push(limpio.slice(inicio, inicio + size));
    inicio += size - overlap;
  }
  return chunks.slice(0, 100); // tope de seguridad por archivo
};

// Indexa un archivo: extrae texto, genera embeddings (en paralelo) y escribe
// UN objeto JSON en S3 (embeddings-cache/{archivoId}.json). Sin escaneos de
// DynamoDB: la escritura es idempotente porque el put reemplaza el objeto.
const indexarUno = async (archivo: Schema['Archivo']['type']): Promise<number> => {
  if (!archivo?.s3Key) return 0;

  const objeto = await s3.send(new GetObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: archivo.s3Key,
  }));
  const buffer = await streamToBuffer(objeto.Body);

  const texto = await extractText(buffer, archivo.nombre || '', archivo.tipo);
  const chunks = chunkText(texto);

  console.log('INDEXAR', JSON.stringify({
    nombre: archivo.nombre,
    tipo: archivo.tipo,
    bytes: buffer.length,
    textoLen: texto.length,
    chunks: chunks.length,
  }));

  if (!chunks.length) return 0;

  // Embeddings con concurrencia limitada (5 a la vez) para velocidad sin throttling.
  const vectores: (number[] | null)[] = new Array(chunks.length).fill(null);
  const CONCURRENCIA = 5;
  for (let i = 0; i < chunks.length; i += CONCURRENCIA) {
    await Promise.all(
      chunks.slice(i, i + CONCURRENCIA).map(async (chunk, j) => {
        try {
          vectores[i + j] = await embed(chunk);
        } catch (e) {
          console.error('ERROR EMBED chunk', i + j, (e as Error)?.message);
        }
      })
    );
  }

  const doc = {
    archivoId: archivo.id,
    empresa: archivo.empresa || '',
    modulo: archivo.modulo || '',
    submodulo: archivo.submodulo || '',
    nombreArchivo: archivo.nombre || '',
    chunks: chunks
      .map((textoChunk, i) => ({ i, texto: textoChunk, embedding: vectores[i] || [] }))
      .filter((c) => c.embedding.length > 0),
  };

  if (!doc.chunks.length) return 0;

  await s3.send(new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: `embeddings-cache/${archivo.id}.json`,
    Body: JSON.stringify(doc),
    ContentType: 'application/json',
  }));

  return doc.chunks.length;
};

export const handler: Schema['indexArchivo']['functionHandler'] = async (event) => {
  const { archivoId } = event.arguments;

  try {
    // Modo archivo unico.
    if (archivoId) {
      const res = await client.models.Archivo.get({ id: archivoId });
      if (!res.data) {
        return { indexados: 0, archivos: 0, mensaje: 'Archivo no encontrado.' };
      }
      const chunks = await indexarUno(res.data);
      return {
        indexados: chunks,
        archivos: 1,
        mensaje: chunks > 0
          ? `Archivo indexado (${chunks} fragmentos).`
          : 'Sin texto extraible (imagen/escaneado o tipo no soportado).',
      };
    }

    // Modo backfill: indexar todos los archivos existentes.
    const todos = await client.models.Archivo.list({ limit: 1000 });

    if (todos.errors?.length) {
      console.error('ERRORES AL LISTAR ARCHIVOS:', JSON.stringify(todos.errors));
      return {
        indexados: 0,
        archivos: 0,
        mensaje: `No se pudo leer Archivo: ${todos.errors.map((e) => e.message).join('; ')}`,
      };
    }

    const lista = (todos.data || []).filter(Boolean);
    let totalChunks = 0;
    let totalArchivos = 0;
    let conTexto = 0;
    let primerError = '';
    for (const archivo of lista) {
      totalArchivos += 1;
      try {
        const chunks = await indexarUno(archivo);
        totalChunks += chunks;
        if (chunks > 0) conTexto += 1;
      } catch (e) {
        const em = (e as { message?: string })?.message || String(e);
        console.error('ERROR EN ARCHIVO', archivo.nombre, em);
        if (!primerError) primerError = `${archivo.nombre}: ${em}`;
      }
    }

    return {
      indexados: totalChunks,
      archivos: totalArchivos,
      mensaje: `Backfill: ${totalArchivos} archivos, ${conTexto} con texto, ${totalChunks} fragmentos.${primerError ? ` 1er error -> ${primerError}` : ''}`,
    };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    console.error('ERROR INDEXANDO:', err?.name, err?.message);
    return {
      indexados: 0,
      archivos: 0,
      mensaje: `Error: ${err?.name || ''} ${err?.message || String(error)}`,
    };
  }
};
