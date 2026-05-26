import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';


export const useEmpresaModulos = () => {

  const client = generateClient({
    config: outputs,
  });

  const [empresaModulos, setEmpresaModulos] = useState([]);

  const loadEmpresaModulos = async () => {

    try {

      const response = await client.models.EmpresaModulo.list();

      setEmpresaModulos(response.data || []);

    } catch (error) {

      console.error('ERROR CARGANDO EMPRESA MODULOS:', error);

      setEmpresaModulos([]);
    }
  };

  const toggleModuloEmpresa = async (
    empresaId,
    moduloId,
    activo
  ) => {

    try {

      const existente = empresaModulos.find(
        em =>
          em.empresaId === empresaId &&
          em.moduloId === moduloId
      );

      if (existente) {

        await client.models.EmpresaModulo.update({
          id: existente.id,
          activo,
        });

      } else {

        await client.models.EmpresaModulo.create({
          empresaId,
          moduloId,
          activo,
        });
      }

      await loadEmpresaModulos();

    } catch (error) {

      console.error('ERROR TOGGLING MODULO:', error);
    }
  };

  return {
    empresaModulos,
    loadEmpresaModulos,
    toggleModuloEmpresa,
  };
};