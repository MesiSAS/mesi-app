import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export function useSubmodulos() {

  const [submodulos, setSubmodulos] = useState([]);

  const loadSubmodulos = async () => {

    const { data } = await client.models.Submodulo.list();

    setSubmodulos(data || []);
  };

  const addSubmodulo = async (nombre, moduloId) => {

    console.log('CREANDO SUBMODULO');

    console.log({
      nombre,
      moduloId,
    });

    const result = await client.models.Submodulo.create({
      nombre,
      moduloId,
    });

    console.log('RESULT:', result);

    await loadSubmodulos();
  };

  const deleteSubmodulo = async (id) => {

    await client.models.Submodulo.delete({ id });

    await loadSubmodulos();
  };

  return {
    submodulos,
    loadSubmodulos,
    addSubmodulo,
    deleteSubmodulo,
  };
}