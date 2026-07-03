import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { ejecutarAlerta } from './core';

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

const env = process.env as Record<string, string>;

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as unknown as DataClientEnv
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

// Corre a diario; el core verifica si hoy coincide con el dia de envio configurado.
export const handler = async () => {
  const resultado = await ejecutarAlerta(client, { force: false });
  console.log('[ALERTA]', resultado.mensaje);
  return resultado;
};
