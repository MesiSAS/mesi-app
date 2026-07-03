import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { ejecutarAlerta } from '../alerta-entregas/core';

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

const env = process.env as Record<string, string>;

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  env as unknown as DataClientEnv
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

// Envio de prueba bajo demanda: ignora 'activo' y el dia programado.
export const handler: Schema['enviarAlertaPrueba']['functionHandler'] = async () => {
  try {
    const resultado = await ejecutarAlerta(client, { force: true });
    return { enviado: resultado.enviado, mensaje: resultado.mensaje };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    console.error('[ALERTA PRUEBA] Error:', err?.name, err?.message);
    return { enviado: false, mensaje: `Error: ${err?.name || ''} ${err?.message || String(error)}` };
  }
};
