import Dexie from 'dexie';

export const archivosDB = new Dexie('MesiArchivosDB');

archivosDB.version(1).stores({
  archivos: 'id, empresa, modulo, año, mes, fecha'
});