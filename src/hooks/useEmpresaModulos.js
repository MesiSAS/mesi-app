import { useCallback, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';


export const useEmpresaModulos = () => {

  const client = useMemo(() => generateClient({
    config: outputs,
  }), []);

  const [empresaModulos, setEmpresaModulos] = useState([]);

  const loadEmpresaModulos = useCallback(async () => {

    try {

      // Paginar: empresas x modulos puede superar el limite de ~100 por pagina.
      let data = [];
      let nextToken = null;
      let pagina = 0;
      do {
        const response = await client.models.EmpresaModulo.list({ limit: 1000, nextToken });
        if (response.errors?.length) {
          console.error('ERROR LISTANDO EMPRESA MODULOS:', response.errors);
        }
        data = data.concat((response.data || []).filter(Boolean));
        nextToken = response.nextToken || null;
        pagina += 1;
      } while (nextToken && pagina < 50);

      setEmpresaModulos(data);

      return data;

    } catch (error) {

      console.error('ERROR CARGANDO EMPRESA MODULOS:', error);

      setEmpresaModulos([]);

      return [];
    }
  }, [client]);

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

  // Activa/desactiva varios modulos de una empresa en una sola operacion,
  // recargando el estado una unica vez al final.
  const setTodosModulos = async (empresaId, moduloIds, activo) => {
    try {
      for (const moduloId of moduloIds) {
        const existente = empresaModulos.find(
          em => em.empresaId === empresaId && em.moduloId === moduloId
        );
        if (existente) {
          if (existente.activo !== activo) {
            await client.models.EmpresaModulo.update({ id: existente.id, activo });
          }
        } else {
          await client.models.EmpresaModulo.create({ empresaId, moduloId, activo });
        }
      }
      await loadEmpresaModulos();
    } catch (error) {
      console.error('ERROR ACTIVANDO TODOS LOS MODULOS:', error);
    }
  };

  return {
    empresaModulos,
    loadEmpresaModulos,
    toggleModuloEmpresa,
    setTodosModulos,
  };
};
