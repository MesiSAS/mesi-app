import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { env } from '$amplify/env/chat-assistant';
import type { Schema } from '../../data/resource';

type ChatSource = {
  archivoId?: string | null;
  nombreArchivo?: string | null;
  modulo?: string | null;
  submodulo?: string | null;
  score?: number | null;
};

type ChatAction = {
  type: string;
  moduloNombre?: string | null;
  archivoId?: string | null;
  nombreArchivo?: string | null;
  label?: string | null;
};

type ScoredChunk = {
  archivoId: string;
  nombreArchivo?: string | null;
  modulo?: string | null;
  submodulo?: string | null;
  texto: string;
  score: number;
};

const textDecoder = new TextDecoder();
const bedrock = new BedrockRuntimeClient({ region: env.AWS_REGION });

// `allow.resource(chatAssistant)` en el schema inyecta AMPLIFY_DATA_DEFAULT_NAME en runtime.
// El cast evita el deadlock de bootstrap: el tipo del env se regenera al final de la sintesis,
// pero el chequeo de tipos corre antes con el archivo de env aun sin esa variable.
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as unknown as DataClientEnv
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const parseJson = <T>(bytes?: Uint8Array): T => {
  if (!bytes) return {} as T;
  return JSON.parse(textDecoder.decode(bytes)) as T;
};

const cosineSimilarity = (a: number[], b: number[]) => {
  if (!a.length || a.length !== b.length) return 0;

  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] * a[index];
    bMagnitude += b[index] * b[index];
  }

  if (!aMagnitude || !bMagnitude) return 0;

  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
};

const embed = async (text: string) => {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: env.BEDROCK_EMBEDDING_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text.slice(0, 8000),
    }),
  }));

  const payload = parseJson<{ embedding?: number[] }>(response.body);

  return payload.embedding || [];
};

type HistMsg = { role: 'user' | 'assistant'; content: string };

const complete = async (
  system: string,
  userMessage: string,
  history: HistMsg[] = [],
  maxTokens = 1200
) => {
  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: [{ type: 'text', text: m.content }],
    })),
    {
      role: 'user' as const,
      content: [{ type: 'text', text: userMessage }],
    },
  ];

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: env.BEDROCK_CHAT_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages,
    }),
  }));

  const payload = parseJson<{ content?: Array<{ text?: string }> }>(response.body);

  return payload.content?.map(item => item.text || '').join('\n').trim() || '';
};

const uniqueSources = (chunks: ScoredChunk[]): ChatSource[] => {
  const byArchivo = new Map<string, ChatSource>();

  chunks.forEach((chunk) => {
    if (!byArchivo.has(chunk.archivoId)) {
      byArchivo.set(chunk.archivoId, {
        archivoId: chunk.archivoId,
        nombreArchivo: chunk.nombreArchivo,
        modulo: chunk.modulo,
        submodulo: chunk.submodulo,
        score: chunk.score,
      });
    }
  });

  return Array.from(byArchivo.values()).slice(0, 5);
};

const extractAction = (raw: string): { answer: string; action: ChatAction | null } => {
  const match = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/(\{[\s\S]*"type"[\s\S]*\})/);

  if (!match) {
    return { answer: raw.trim(), action: null };
  }

  let action: ChatAction | null = null;

  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed && typeof parsed.type === 'string') {
      action = parsed as ChatAction;
    }
  } catch {
    action = null;
  }

  const answer = raw.replace(match[0], '').trim();

  return { answer: answer || raw.trim(), action };
};

export const handler: Schema['chatAssistant']['functionHandler'] = async (event) => {
 try {
  const { userId, message, empresa, modulo, moduloActivo } = event.arguments;
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      answer: 'Escribeme una pregunta para poder ayudarte.',
      sources: [],
    };
  }

  const userResponse = await client.models.Usuario.get({ id: userId });
  const user = userResponse.data;

  if (!user) {
    throw new Error('Usuario no autorizado.');
  }

  // ----- Memoria por usuario: historial reciente + perfil destilado -----
  const [historialResponse, perfilResponse] = await Promise.all([
    client.models.ChatMessage.list({
      filter: { userId: { eq: userId } },
      limit: 200,
    }),
    client.models.PerfilUsuario.list({
      filter: { userId: { eq: userId } },
      limit: 1,
    }),
  ]);

  const historial: HistMsg[] = (historialResponse.data || [])
    .filter((m): m is NonNullable<typeof m> => !!m && (m.role === 'user' || m.role === 'assistant'))
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const perfilExistente = perfilResponse.data?.[0] || null;
  const perfilResumen = perfilExistente?.resumen || '';

  const esAdmin = user.tipo === 'admin';

  // Aislamiento: usuarios no-admin SIEMPRE quedan atados a su propia empresa
  // (ignoramos cualquier 'empresa' que venga del cliente, por seguridad).
  // Admin: la empresa indicada, o TODAS si no se indica ninguna.
  const empresaAutorizada = esAdmin ? (empresa || null) : user.empresa;
  const verTodo = esAdmin && !empresaAutorizada;

  const empresasResponse = await client.models.Empresa.list();
  const empresaData = empresaAutorizada
    ? (empresasResponse.data || []).find(item => item?.nombre === empresaAutorizada)
    : null;

  // Solo los no-admin requieren una empresa valida. El admin puede ver todo.
  if (!esAdmin && !empresaData) {
    throw new Error('Empresa no autorizada.');
  }

  const [modulosResponse, relacionesResponse, archivosResponse, embeddingsResponse] = await Promise.all([
    client.models.Modulo.list(),
    client.models.EmpresaModulo.list(),
    client.models.Archivo.list(),
    client.models.ArchivoEmbedding.list(),
  ]);

  const relacionesActivas = (relacionesResponse.data || []).filter(
    relacion =>
      empresaData
        ? relacion?.empresaId === empresaData.id && relacion.activo
        : false
  );

  const modulosActivos = new Set(
    (modulosResponse.data || [])
      .filter(moduloData =>
        verTodo
          ? true // admin viendo todo: todos los modulos disponibles
          : relacionesActivas.some(relacion => relacion.moduloId === moduloData?.id)
      )
      .map(moduloData => moduloData?.nombre)
      .filter(Boolean)
  );

  const archivosPermitidos = (archivosResponse.data || []).filter((archivo) => {
    if (!archivo) return false;
    // Aislamiento por empresa (no aplica cuando admin ve todo).
    if (empresaAutorizada && archivo.empresa !== empresaAutorizada) return false;
    // Los archivos ocultos solo los ve un admin.
    if (archivo.oculto && !esAdmin) return false;

    const nombreModulo = archivo.modulo?.includes('__')
      ? archivo.modulo.split('__')[0]
      : archivo.modulo;

    if (!nombreModulo) return false;
    if (!verTodo && !modulosActivos.has(nombreModulo)) return false;
    if (modulo && nombreModulo !== modulo) return false;

    return true;
  });

  const archivosPermitidosPorId = new Map(
    archivosPermitidos.map(archivo => [archivo.id, archivo])
  );

  const queryEmbedding = await embed(cleanMessage);
  const chunks = (embeddingsResponse.data || [])
    .filter((chunk) => {
      if (!chunk) return false;
      if (!archivosPermitidosPorId.has(chunk.archivoId)) return false;
      if (chunk.oculto && user.tipo !== 'admin') return false;
      return Array.isArray(chunk.embedding) && chunk.embedding.length > 0;
    })
    .map((chunk) => ({
      archivoId: chunk.archivoId,
      nombreArchivo: chunk.nombreArchivo,
      modulo: chunk.modulo,
      submodulo: chunk.submodulo,
      texto: chunk.texto,
      score: cosineSimilarity(
        queryEmbedding,
        (chunk.embedding || []).filter((value): value is number => typeof value === 'number')
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const archivosResumen = archivosPermitidos
    .slice(0, 30)
    .map(archivo => `- ${archivo.nombre} (${archivo.modulo}, ${archivo.anio || 'sin ano'}-${archivo.mes || 'sin mes'})`)
    .join('\n');

  const contextoChunks = chunks.length
    ? chunks.map((chunk, index) => [
      `[Fuente ${index + 1}] ${chunk.nombreArchivo || 'Archivo'} | ${chunk.modulo || 'Modulo'}${chunk.submodulo ? ` / ${chunk.submodulo}` : ''}`,
      chunk.texto,
    ].join('\n')).join('\n\n')
    : 'No hay chunks indexados para responder sobre contenido interno de archivos.';

  const modulosDisponiblesLista = Array.from(modulosActivos).join(', ') || 'ninguno';

  const system = [
    'Eres el asistente IA de la plataforma Mesi, un portal donde las empresas consultan sus documentos.',
    '',
    'ESTILO DE RESPUESTA (muy importante):',
    '- Responde de forma BREVE y directa: 1 a 3 frases cuando sea posible. Maximo un parrafo corto.',
    '- Tono gerencial y claro, para personas de negocio. Nada tecnico.',
    '- PROHIBIDO mencionar detalles tecnicos: nada de base de datos, embeddings, JSON, chunks, indexacion, IDs, rutas, claves, formatos de archivo ni como esta guardada la informacion.',
    '- Habla del CONTENIDO y su utilidad para el negocio, no de como esta almacenado.',
    '- No saludes ni uses el nombre/apodo del usuario en cada mensaje; saluda solo al inicio de la conversacion si corresponde.',
    '- Si te apoyas en un documento, puedes mencionar su nombre de forma natural (ej: "segun el informe de ventas"), sin tecnicismos.',
    '',
    'REGLAS:',
    '- Responde solo con la informacion autorizada para este usuario. Si no hay informacion suficiente, dilo en una frase sencilla.',
    '- Nunca reveles datos de empresas, modulos o archivos que no correspondan al usuario.',
    '',
    'NAVEGACION (uso interno, nunca lo expliques al usuario):',
    'Si el usuario pide abrir/ir a un modulo o ver un archivo, agrega al FINAL un bloque ```json con la accion. El sistema lo convierte en un boton; el usuario NO ve el JSON.',
    'Para abrir un modulo: {"type":"open_module","moduloNombre":"<nombre exacto de un modulo disponible>","label":"Ir a <nombre>"}',
    'Para abrir un archivo: {"type":"open_file","archivoId":"<id exacto del archivo>","nombreArchivo":"<nombre>","label":"Abrir <nombre>"}',
    'Usa solo moduloNombre de la lista disponible y archivoId de la lista visible. Si no implica navegar, no agregues bloque.',
    ...(perfilResumen
      ? ['', 'CONTEXTO DEL USUARIO (uso interno, no lo recites):', perfilResumen]
      : []),
  ].join('\n');

  const archivosResumenConId = archivosPermitidos
    .slice(0, 30)
    .map(archivo => `- id=${archivo.id} | ${archivo.nombre} (${archivo.modulo}, ${archivo.anio || 'sin ano'}-${archivo.mes || 'sin mes'})`)
    .join('\n');

  const prompt = [
    `Usuario: ${user.nombre} (${user.tipo})`,
    `Empresa autorizada: ${empresaAutorizada || 'TODAS (acceso de administrador)'}`,
    `Modulos disponibles: ${modulosDisponiblesLista}`,
    moduloActivo ? `El usuario esta viendo actualmente el modulo: ${moduloActivo}` : 'El usuario esta en el panel principal (sin modulo abierto).',
    '',
    'Archivos visibles para este usuario:',
    archivosResumenConId || 'No hay archivos visibles.',
    '',
    'Contenido recuperado por embeddings:',
    contextoChunks,
    '',
    'Pregunta del usuario:',
    cleanMessage,
  ].join('\n');

  const rawAnswer = await complete(system, prompt, historial, 500);
  const { answer, action: rawAction } = extractAction(rawAnswer);
  const sources = uniqueSources(chunks);

  let action: ChatAction | null = null;

  if (rawAction?.type === 'open_module') {
    const nombre = rawAction.moduloNombre;
    if (nombre && modulosActivos.has(nombre)) {
      action = { type: 'open_module', moduloNombre: nombre, label: rawAction.label || `Ir a ${nombre}` };
    }
  } else if (rawAction?.type === 'open_file') {
    const archivo = rawAction.archivoId ? archivosPermitidosPorId.get(rawAction.archivoId) : undefined;
    if (archivo) {
      const nombreModulo = archivo.modulo?.includes('__')
        ? archivo.modulo.split('__')[0]
        : archivo.modulo;
      action = {
        type: 'open_file',
        archivoId: archivo.id,
        nombreArchivo: archivo.nombre,
        moduloNombre: nombreModulo,
        label: rawAction.label || `Abrir ${archivo.nombre}`,
      };
    }
  }

  // ChatMessage.empresa es requerido; para admin sin empresa usamos su propia
  // empresa (o 'admin') como etiqueta de almacenamiento.
  const empresaParaGuardar = empresaAutorizada || user.empresa || 'admin';

  await Promise.all([
    client.models.ChatMessage.create({
      userId,
      empresa: empresaParaGuardar,
      role: 'user',
      content: cleanMessage,
      createdAt: new Date().toISOString(),
    }),
    client.models.ChatMessage.create({
      userId,
      empresa: empresaParaGuardar,
      role: 'assistant',
      content: answer,
      sources: JSON.stringify(sources),
      createdAt: new Date().toISOString(),
    }),
  ]);

  // ----- Actualizar el perfil/memoria del usuario (aprendizaje incremental) -----
  try {
    const sysPerfil = [
      'Eres un sistema que mantiene un perfil breve de un usuario de la plataforma Mesi.',
      'Devuelve UNICAMENTE el perfil actualizado en texto plano (max 120 palabras), sin preambulos.',
      'Incluye: rol, empresa, intereses, modulos/temas que consulta con frecuencia y preferencias de trato.',
      'Integra lo nuevo con lo anterior; no repitas ni inventes datos no evidenciados.',
    ].join('\n');

    const promptPerfil = [
      `Perfil actual:\n${perfilResumen || '(vacio)'}`,
      '',
      `Usuario: ${user.nombre} (${user.tipo}) - empresa ${empresaAutorizada || 'todas (admin)'}`,
      `Ultima pregunta: ${cleanMessage}`,
      `Ultima respuesta: ${answer.slice(0, 500)}`,
      '',
      'Perfil actualizado:',
    ].join('\n');

    const nuevoResumen = await complete(sysPerfil, promptPerfil, [], 300);

    if (nuevoResumen) {
      if (perfilExistente) {
        await client.models.PerfilUsuario.update({
          id: perfilExistente.id,
          resumen: nuevoResumen,
          actualizado: new Date().toISOString(),
        });
      } else {
        await client.models.PerfilUsuario.create({
          userId,
          resumen: nuevoResumen,
          actualizado: new Date().toISOString(),
        });
      }
    }
  } catch (perfilError) {
    console.error('No se pudo actualizar el perfil del usuario:', perfilError);
  }

  return {
    answer,
    sources,
    action,
  };
 } catch (error) {
    // DEBUG: exponer el error real para diagnostico. Quitar cuando este resuelto.
    const err = error as { name?: string; message?: string; stack?: string };
    console.error('chatAssistant error:', JSON.stringify({
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    }, null, 2));

    return {
      answer: `⚠️ DEBUG ERROR\nname: ${err?.name || 'desconocido'}\nmessage: ${err?.message || String(error)}\nchatModel: ${env.BEDROCK_CHAT_MODEL_ID}\nembedModel: ${env.BEDROCK_EMBEDDING_MODEL_ID}`,
      sources: [],
      action: null,
    };
  }
};
