import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';
import 'dotenv/config';

// Los IDs de modelo se leen del .env del proyecto (con fallback por si no esta definido).
export const BEDROCK_CHAT_MODEL_ID = process.env.BEDROCK_CHAT_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
export const BEDROCK_EMBEDDING_MODEL_ID = process.env.BEDROCK_EMBEDDING_MODEL_ID ?? 'amazon.titan-embed-text-v2:0';

export const chatAssistant = defineFunction({
  entry: '../functions/chat-assistant/handler.ts',
  name: 'chat-assistant',
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    BEDROCK_CHAT_MODEL_ID,
    BEDROCK_EMBEDDING_MODEL_ID,
  },
});

export const indexArchivo = defineFunction({
  entry: '../functions/index-archivo/handler.ts',
  name: 'index-archivo',
  timeoutSeconds: 300,
  memoryMB: 2048,
  environment: {
    BEDROCK_EMBEDDING_MODEL_ID,
  },
});

// Alerta de entregas incompletas (mes vencido). Corre A DIARIO; internamente
// solo envia si esta activa y si hoy coincide con el dia de envio configurado.
export const alertaEntregas = defineFunction({
  entry: '../functions/alerta-entregas/handler.ts',
  name: 'alerta-entregas',
  timeoutSeconds: 120,
  memoryMB: 512,
  schedule: '0 13 * * ?',
});

// Envio de prueba bajo demanda (mutation).
export const enviarAlertaPrueba = defineFunction({
  entry: '../functions/enviar-alerta-prueba/handler.ts',
  name: 'enviar-alerta-prueba',
  timeoutSeconds: 120,
  memoryMB: 512,
});

const schema = a.schema({

  Archivo: a
    .model({
      empresa: a.string(),
      modulo: a.string(),
      submodulo: a.string(),

      nombre: a.string(),

      url: a.string(),

      s3Key: a.string(),

      tamano: a.integer(),

      tipo: a.string(),

      oculto: a.boolean(),

      fecha: a.datetime(),

      anio: a.string(),

      mes: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  Empresa: a
    .model({
      nombre: a.string().required(),

      logo: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  Modulo: a
    .model({
      nombre: a.string().required(),

      icono: a.string(),

      logo: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

   Usuario: a
    .model({
        empresa: a.string().required(),
        correo: a.string().required(),
        nombre: a.string().required(),
        tipo: a.string().required(),
        password: a.string().required(),
        logo: a.string(),
    })
    .authorization((allow) => [
        allow.publicApiKey(),
    ]), 

  Submodulo: a
  .model({
    nombre: a.string().required(),

    moduloId: a.string().required(),
  })
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

   EmpresaModulo: a
    .model({
        empresaId: a.string().required(),
        moduloId: a.string().required(),
        activo: a.boolean().default(true),
    })
    .authorization((allow) => [allow.publicApiKey()]), 

  ArchivoEmbedding: a
    .model({
      archivoId: a.string().required(),
      empresa: a.string().required(),
      modulo: a.string().required(),
      submodulo: a.string(),
      s3Key: a.string(),
      nombreArchivo: a.string(),
      chunkIndex: a.integer().required(),
      texto: a.string().required(),
      embedding: a.float().array(),
      oculto: a.boolean().default(false),
      fecha: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),
     
    ]),

  ChatMessage: a
    .model({
      userId: a.string().required(),
      empresa: a.string().required(),
      role: a.string().required(),
      content: a.string().required(),
      sources: a.string(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey(),

    ]),

  // Perfil/memoria destilada por usuario: la IA va resumiendo lo aprendido.
  PerfilUsuario: a
    .model({
      userId: a.string().required(),
      resumen: a.string(),
      actualizado: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Configuracion (singleton) de la alerta mensual de entregas. Opt-in: solo
  // se envia correo si 'activo' es true. 'email' = destinatarios (coma).
  AlertaEntregas: a
    .model({
      activo: a.boolean().default(false),
      email: a.string(),
      remitente: a.string(),
      diaEnvio: a.integer().default(1),
      actualizado: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  ChatSource: a.customType({
    archivoId: a.string(),
    nombreArchivo: a.string(),
    modulo: a.string(),
    submodulo: a.string(),
    score: a.float(),
  }),

  ChatAction: a.customType({
    type: a.string(),
    moduloNombre: a.string(),
    archivoId: a.string(),
    nombreArchivo: a.string(),
    label: a.string(),
  }),

  ChatAssistantResponse: a.customType({
    answer: a.string(),
    sources: a.ref('ChatSource').array(),
    action: a.ref('ChatAction'),
  }),

  chatAssistant: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      message: a.string().required(),
      empresa: a.string(),
      modulo: a.string(),
      moduloActivo: a.string(),
    })
    .returns(a.ref('ChatAssistantResponse'))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(chatAssistant)),

  IndexResponse: a.customType({
    indexados: a.integer(),
    archivos: a.integer(),
    mensaje: a.string(),
  }),

  indexArchivo: a
    .mutation()
    .arguments({
      // Si se omite archivoId, se hace backfill de todos los archivos.
      archivoId: a.string(),
    })
    .returns(a.ref('IndexResponse'))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(indexArchivo)),

  AlertaPruebaResponse: a.customType({
    enviado: a.boolean(),
    mensaje: a.string(),
  }),

  enviarAlertaPrueba: a
    .mutation()
    .returns(a.ref('AlertaPruebaResponse'))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(enviarAlertaPrueba)),

})
.authorization((allow) => [
  allow.resource(chatAssistant),
  allow.resource(indexArchivo),
  allow.resource(alertaEntregas),
  allow.resource(enviarAlertaPrueba),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,

  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',

    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
