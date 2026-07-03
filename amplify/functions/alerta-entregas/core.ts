import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const REQ_PDF = 2;
const REQ_EDITABLE = 2;

const ses = new SESClient({ region: process.env.AWS_REGION });

const listAll = async <T>(
  listFn: (args: { limit?: number; nextToken?: string | null }) => Promise<{ data?: (T | null)[]; nextToken?: string | null }>,
): Promise<T[]> => {
  let todos: T[] = [];
  let nextToken: string | null | undefined = null;
  let pagina = 0;
  do {
    const res = await listFn({ limit: 1000, nextToken });
    todos = todos.concat((res.data || []).filter((x): x is T => !!x));
    nextToken = res.nextToken;
    pagina += 1;
  } while (nextToken && pagina < 50);
  return todos;
};

const clasificar = (nombre = '', tipo = ''): 'pdf' | 'editable' | 'otro' => {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  const mime = (tipo || '').toLowerCase();
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'xlsm'].includes(ext)
    || mime.includes('word') || mime.includes('presentation') || mime.includes('sheet')) {
    return 'editable';
  }
  return 'otro';
};

const baseModulo = (m = '') => (m.includes('__') ? m.split('__')[0] : m);

export type ResultadoAlerta = { enviado: boolean; mensaje: string };

// Ejecuta la logica de la alerta. force=true la usa el envio de prueba: ignora
// el estado 'activo' y el dia programado, pero igual necesita destinatarios.
export const ejecutarAlerta = async (
  client: any,
  { force = false }: { force?: boolean } = {}
): Promise<ResultadoAlerta> => {
  const configs = await client.models.AlertaEntregas.list({ limit: 5 });
  const config = (configs.data || [])[0];

  if (!config) {
    return { enviado: false, mensaje: 'No hay configuracion de alerta.' };
  }

  const hoy = new Date();
  const diaEnvio = Number(config.diaEnvio) || 1;

  if (!force) {
    if (!config.activo) {
      return { enviado: false, mensaje: 'Alerta desactivada.' };
    }
    if (hoy.getDate() !== diaEnvio) {
      return { enviado: false, mensaje: `Hoy (${hoy.getDate()}) no es el dia de envio (${diaEnvio}).` };
    }
  }

  const destinatarios = (config.email || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const remitente = (config.remitente || '').trim();

  if (!destinatarios.length || !remitente) {
    return { enviado: false, mensaje: 'Falta remitente o destinatarios.' };
  }

  // Mes vencido.
  const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const anio = String(prev.getFullYear());
  const mes = String(prev.getMonth() + 1).padStart(2, '0');

  const [empresas, modulos, empresaModulos, archivos] = await Promise.all([
    listAll<any>((a) => client.models.Empresa.list(a)),
    listAll<any>((a) => client.models.Modulo.list(a)),
    listAll<any>((a) => client.models.EmpresaModulo.list(a)),
    listAll<any>((a) => client.models.Archivo.list(a)),
  ]);

  const incompletos: string[] = [];
  for (const empresa of empresas) {
    const modulosActivos = empresaModulos
      .filter((em) => em.empresaId === empresa.id && em.activo)
      .map((em) => modulos.find((m) => m.id === em.moduloId))
      .filter(Boolean);

    for (const modulo of modulosActivos) {
      const delModulo = archivos.filter(
        (a) =>
          a.empresa === empresa.nombre &&
          baseModulo(a.modulo || '') === modulo.nombre &&
          a.anio === anio &&
          a.mes === mes
      );
      const pdf = delModulo.filter((a) => clasificar(a.nombre || '', a.tipo || '') === 'pdf').length;
      const editable = delModulo.filter((a) => clasificar(a.nombre || '', a.tipo || '') === 'editable').length;
      if (pdf < REQ_PDF || editable < REQ_EDITABLE) {
        incompletos.push(`${empresa.nombre} · ${modulo.nombre}: ${pdf}/${REQ_PDF} PDF, ${editable}/${REQ_EDITABLE} editables`);
      }
    }
  }

  const periodoLabel = `${mes}/${anio}`;

  if (!incompletos.length) {
    return { enviado: false, mensaje: `Todo completo para ${periodoLabel}, no se envio correo.` };
  }

  const filas = incompletos.map((i) => `<li>${i}</li>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1d1d1f">
      <h2 style="color:#0A353F">Entregas incompletas · ${periodoLabel}${force ? ' (PRUEBA)' : ''}</h2>
      <p>Las siguientes empresas/módulos no cumplen el requisito de 2 PDF + 2 editables:</p>
      <ul>${filas}</ul>
      <p style="color:#888;font-size:12px">Mesi · alerta automática de entregas.</p>
    </div>`;
  const texto = `Entregas incompletas (${periodoLabel}):\n\n${incompletos.join('\n')}`;

  await ses.send(new SendEmailCommand({
    Source: remitente,
    Destination: { ToAddresses: destinatarios },
    Message: {
      Subject: { Data: `Mesi · Entregas incompletas ${periodoLabel}${force ? ' (prueba)' : ''} (${incompletos.length})` },
      Body: { Html: { Data: html }, Text: { Data: texto } },
    },
  }));

  return { enviado: true, mensaje: `Correo enviado a ${destinatarios.join(', ')} (${incompletos.length} incompletos).` };
};
