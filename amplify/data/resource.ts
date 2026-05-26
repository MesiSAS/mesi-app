import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

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

});

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