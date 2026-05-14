import { archivosDB } from '../data/archivosDB';

export const useArchivos = () => {

  const saveArchivo = async (empresa, modulo, año, mes, file) => {

    const archivo = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      empresa,
      modulo,
      año,
      mes,

      nombre: file.name,
      tamaño: file.size,
      tipo: file.type,
      fecha: new Date().toISOString(),

      oculto: false,

      file
    };

    await archivosDB.archivos.add(archivo);

    return archivo;
  };

  const getArchivosFiltrados = async (
    empresa,
    modulo,
    año,
    mes,
    mostrarOcultos = false
  ) => {

    let archivos = await archivosDB.archivos
      .where({
        empresa,
        modulo
      })
      .toArray();

    if (año) {
      archivos = archivos.filter(a => a.año === año);
    }

    if (mes) {
      archivos = archivos.filter(a => a.mes === mes);
    }

    if (!mostrarOcultos) {
      archivos = archivos.filter(a => !a.oculto);
    }

    return archivos.sort((a, b) => {
      return new Date(b.fecha) - new Date(a.fecha);
    });
  };

  const toggleOculto = async (empresa, modulo, año, mes, id) => {

    const archivo = await archivosDB.archivos.get(id);

    if (!archivo) return;

    await archivosDB.archivos.update(id, {
      oculto: !archivo.oculto
    });
  };

  const deleteArchivo = async (empresa, modulo, año, mes, id) => {
    await archivosDB.archivos.delete(id);
  };

  const downloadArchivo = (archivo) => {

    const url = URL.createObjectURL(archivo.file);

    const link = document.createElement('a');

    link.href = url;
    link.download = archivo.nombre;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const getAñosDisponibles = async (empresa, modulo) => {

    const archivos = await archivosDB.archivos
      .where({
        empresa,
        modulo
      })
      .toArray();

    const años = [...new Set(archivos.map(a => a.año))];

    return años.sort().reverse();
  };

  return {
    saveArchivo,
    getArchivosFiltrados,
    toggleOculto,
    deleteArchivo,
    downloadArchivo,
    getAñosDisponibles
  };
};