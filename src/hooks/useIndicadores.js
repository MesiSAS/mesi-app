import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export const useIndicadores = () => {
  // Trae todos los indicadores (paginado).
  const getIndicadores = async () => {
    let todos = [];
    let nextToken = null;
    let pagina = 0;
    do {
      const res = await client.models.IndicadorEmpresa.list({ limit: 1000, nextToken });
      if (res.errors?.length) console.error('ERROR LISTANDO INDICADORES:', res.errors);
      todos = todos.concat((res.data || []).filter(Boolean));
      nextToken = res.nextToken || null;
      pagina += 1;
    } while (nextToken && pagina < 50);
    return todos;
  };

  const confirmarIndicador = async (id, valor) => {
    const res = await client.models.IndicadorEmpresa.update({
      id,
      ...(valor !== undefined ? { valor: Number(valor) } : {}),
      estado: 'confirmado',
      actualizado: new Date().toISOString(),
    });
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    return res.data;
  };

  const editarValor = async (id, valor) => {
    const res = await client.models.IndicadorEmpresa.update({
      id, valor: Number(valor), actualizado: new Date().toISOString(),
    });
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    return res.data;
  };

  const eliminarIndicador = async (id) => {
    await client.models.IndicadorEmpresa.delete({ id });
  };

  // Dispara la extracción con IA de un archivo.
  const extraer = async (archivoId) => {
    const res = await client.mutations.extraerIndicadores({ archivoId });
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    return res.data;
  };

  return { getIndicadores, confirmarIndicador, editarValor, eliminarIndicador, extraer };
};
