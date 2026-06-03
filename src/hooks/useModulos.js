import { useCallback, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';

export const useModulos = () => {

  const client = useMemo(() => generateClient({
    config: outputs,
  }), []);

  const [modulos, setModulos] = useState([]);

  const loadModulos = useCallback(async () => {

    try {

      const response = await client.models.Modulo.list();

      const data = response.data || [];

      setModulos(data);

      return data;

    } catch (error) {

      console.error('ERROR CARGANDO MODULOS:', error);

      setModulos([]);

      return [];
    }
  }, [client]);

  const createModulo = async (data) => {

    await client.models.Modulo.create({
      nombre: data.nombre,
      icono: data.icono,
      logo: data.logo || '',
    });

    await loadModulos();
  };

  const updateModulo = async (id, data) => {

    await client.models.Modulo.update({
      id,
      nombre: data.nombre,
      icono: data.icono,
      logo: data.logo || '',
    });

    await loadModulos();
  };

  const deleteModulo = async (id) => {

    await client.models.Modulo.delete({
      id,
    });

    await loadModulos();
  };

  return {
    modulos,
    loadModulos,
    createModulo,
    updateModulo,
    deleteModulo,
  };
};
