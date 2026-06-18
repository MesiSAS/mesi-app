import { uploadData, getUrl, remove } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';

const getClient = () => generateClient();

export const useArchivos = () => {

  // =========================
  // SUBIR ARCHIVO
  // =========================
  const saveArchivo = async (empresa, modulo, anio, mes, file) => {
    try {
      const fileKey = `archivos/${empresa}/${modulo}/${anio}/${mes}/${Date.now()}-${file.name}`;
      
      console.log('SUBIENDO A:', fileKey);
      // Subir a S3
      const uploadResult = await uploadData({
        path: fileKey,
        data: file,
        options: {
          contentType: file.type,
        },
      }).result;

      console.log('UPLOAD RESULT:', uploadResult);

      // Obtener URL
      const urlResult = await getUrl({
        path: fileKey,
      });

      // Guardar metadata en DynamoDB
      const response = await getClient().models.Archivo.create({
  empresa,
  modulo,
  submodulo: '',
  nombre: file.name,
  s3Key: fileKey,
  tamano: file.size,
  tipo: file.type,
  oculto: false,
  fecha: new Date().toISOString(),
  anio,
  mes,
});

console.log('CREATE RESPONSE:', response);

      // Indexacion automatica: generar embeddings del nuevo archivo en segundo
      // plano (no bloquea la subida). El backend extrae el texto y lo vectoriza.
      const nuevoId = response?.data?.id;
      if (nuevoId) {
        getClient()
          .mutations.indexArchivo({ archivoId: nuevoId })
          .then((res) => console.log('INDEX RESPONSE:', res?.data))
          .catch((err) => console.error('ERROR INDEXANDO ARCHIVO:', err));
      }

    } catch (error) {
        console.error('ERROR SUBIENDO ARCHIVO COMPLETO:', JSON.stringify(error, null, 2));
        console.error(error);
        throw error;
      }
  };

  // =========================
  // OBTENER ARCHIVOS
  // =========================
 const getArchivosFiltrados = async (
  empresa,
  modulo,
  anio = '',
  mes = '',
  mostrarOcultos = false
) => {
  try {

    const response = await getClient().models.Archivo.list();

    let archivos = (response.data || []).filter(Boolean);

    archivos = archivos.filter((a) => {

      if (a.empresa !== empresa) return false;

      if (a.modulo !== modulo) return false;

      if (anio && a.anio !== anio) return false;

      if (mes && a.mes !== mes) return false;

      if (!mostrarOcultos && a.oculto) return false;

      return true;
    });

    // GENERAR URLS FIRMADAS
    const archivosConUrl = await Promise.all(

      archivos.map(async (archivo) => {

        try {

          console.log('GENERANDO URL PARA:', archivo.s3Key);

          const result = await getUrl({
            path: archivo.s3Key,
          });

          return {
            ...archivo,
            url: result.url.toString(),
          };

        } catch (err) {

          console.error('ERROR GENERANDO URL:', err);

          return {
            ...archivo,
            url: null,
          };
        }
      })
    );

    console.log('ARCHIVOS FINALES:', archivosConUrl);

    return archivosConUrl.sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

  } catch (error) {

    console.error('ERROR OBTENIENDO ARCHIVOS:', error);

    return [];
  }
};

  // =========================
  // ELIMINAR ARCHIVO
  // =========================
  const deleteArchivo = async (
    empresa,
    modulo,
    anio,
    mes,
    id,
    s3Key
  ) => {
    try {
      console.log('S3KEY:', s3Key);
      // Eliminar de S3
      await remove({
        path: s3Key,
      });

      // Eliminar metadata
      await getClient().models.Archivo.delete({
        id,
      });

    } catch (error) {
      console.error('ERROR ELIMINANDO ARCHIVO:', error);
    }
  };

  // =========================
  // DESCARGAR
  // =========================
  const downloadArchivo = async (archivo) => {
    window.open(archivo.url, '_blank');
  };

  // =========================
  // OCULTAR / MOSTRAR
  // =========================
  const toggleOculto = async (
    empresa,
    modulo,
    anio,
    mes,
    id
  ) => {
    try {

      const archivo = await getClient().models.Archivo.get({ id });

      if (!archivo.data) return;

      await getClient().models.Archivo.update({
        id,
        oculto: !archivo.data.oculto,
      });

    } catch (error) {
      console.error('ERROR TOGGLE OCULTO:', error);
      throw error;
    }
  };

  // =========================
  // RE-INDEXAR TODO (backfill)
  // =========================
  // Genera embeddings para todos los archivos ya cargados. Se usa una sola vez
  // (o cuando se quiera reconstruir el indice). Omitir archivoId = backfill.
  // Backfill archivo por archivo: cada llamada individual cabe en el limite de
  // 30s del resolver de AppSync (un backfill monolitico se pasa y se corta).
  const reindexarTodos = async (onProgress) => {
    const lista = await getClient().models.Archivo.list({ limit: 1000 });
    if (lista.errors?.length) {
      throw new Error(lista.errors.map((e) => e.message).join('; '));
    }

    const archivos = (lista.data || []).filter(Boolean);
    let indexados = 0;
    let conTexto = 0;
    let fallos = 0;
    let primerError = '';

    for (let i = 0; i < archivos.length; i += 1) {
      try {
        const res = await getClient().mutations.indexArchivo({ archivoId: archivos[i].id });
        if (res?.errors?.length) {
          fallos += 1;
          if (!primerError) primerError = res.errors.map((e) => e.message).join('; ');
          console.error('INDEX ERROR', archivos[i].nombre, res.errors);
        } else {
          const n = res?.data?.indexados || 0;
          indexados += n;
          if (n > 0) conTexto += 1;
        }
      } catch (err) {
        fallos += 1;
        if (!primerError) primerError = err?.message || String(err);
        console.error('INDEX EXCEPTION', archivos[i].nombre, err);
      }
      onProgress?.(i + 1, archivos.length);
    }

    return { archivos: archivos.length, conTexto, indexados, fallos, primerError };
  };

  return {
    saveArchivo,
    getArchivosFiltrados,
    deleteArchivo,
    downloadArchivo,
    toggleOculto,
    reindexarTodos,
  };
};