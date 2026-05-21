import { a, defineData } from '@aws-amplify/backend';

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
    .authorization((allow) => [allow.publicApiKey()]),
});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
  },
});