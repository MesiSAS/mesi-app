import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Requisito por empresa/modulo en el mes vencido: 2 PDF + 2 editables.
const REQ_PDF = 2;
const REQ_EDITABLE = 2;

const clasificar = (nombre = '', tipo = '') => {
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

// Ultimos 6 periodos (mes vencido primero).
const construirPeriodos = () => {
  const now = new Date();
  const lista = [];
  for (let i = 1; i <= 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    lista.push({
      anio: String(d.getFullYear()),
      mes: String(d.getMonth() + 1).padStart(2, '0'),
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return lista;
};

const estadoDe = (pdf, editable) => {
  if (pdf === 0 && editable === 0) return 'rojo';
  if (pdf >= REQ_PDF && editable >= REQ_EDITABLE) return 'verde';
  return 'amarillo';
};

const COLORES = {
  verde: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', label: 'Completo' },
  amarillo: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Incompleto' },
  rojo: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'Sin archivos' },
};

const VerificadorEntregas = ({ empresas, modulos, empresaModulos, archivos, onAbrir }) => {
  const periodos = useMemo(construirPeriodos, []);
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const periodo = periodos[periodoIdx];

  // Matriz: por cada empresa, sus modulos activos con conteo pdf/editable.
  const filas = useMemo(() => {
    return empresas.map((empresa) => {
      const modulosActivos = empresaModulos
        .filter((em) => em.empresaId === empresa.id && em.activo)
        .map((em) => modulos.find((m) => m.id === em.moduloId))
        .filter(Boolean);

      const celdas = modulosActivos.map((modulo) => {
        const delModulo = archivos.filter(
          (a) =>
            a.empresa === empresa.nombre &&
            baseModulo(a.modulo) === modulo.nombre &&
            a.anio === periodo.anio &&
            a.mes === periodo.mes
        );
        const pdf = delModulo.filter((a) => clasificar(a.nombre, a.tipo) === 'pdf').length;
        const editable = delModulo.filter((a) => clasificar(a.nombre, a.tipo) === 'editable').length;
        return { modulo, pdf, editable, estado: estadoDe(pdf, editable) };
      });

      const resumen = celdas.reduce(
        (acc, c) => {
          acc[c.estado] += 1;
          return acc;
        },
        { verde: 0, amarillo: 0, rojo: 0 }
      );
      const estadoEmpresa = celdas.length === 0
        ? 'rojo'
        : resumen.rojo > 0 || resumen.amarillo > 0
          ? (resumen.verde === 0 && resumen.amarillo === 0 ? 'rojo' : 'amarillo')
          : 'verde';

      return { empresa, celdas, estadoEmpresa };
    });
  }, [empresas, modulos, empresaModulos, archivos, periodo]);

  const totales = useMemo(() => {
    const t = { verde: 0, amarillo: 0, rojo: 0 };
    filas.forEach((f) => f.celdas.forEach((c) => { t[c.estado] += 1; }));
    return t;
  }, [filas]);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#1d1d1f]">Verificador de entregas</h2>
          <p className="text-gray-500 text-sm">
            Requisito por módulo: {REQ_PDF} PDF + {REQ_EDITABLE} editables (docx/pptx).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Leyenda */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            {['verde', 'amarillo', 'rojo'].map((e) => (
              <span key={e} className="flex items-center gap-1.5 text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-full ${COLORES[e].dot}`} /> {COLORES[e].label}
              </span>
            ))}
          </div>

          {/* Selector de periodo */}
          <div className="relative">
            <select
              value={periodoIdx}
              onChange={(e) => setPeriodoIdx(Number(e.target.value))}
              className="appearance-none bg-[#F5F5F7] rounded-xl pl-4 pr-9 py-2 text-sm font-medium text-[#0A353F] outline-none cursor-pointer"
            >
              {periodos.map((p, i) => (
                <option key={`${p.anio}-${p.mes}`} value={i}>
                  {p.label}{i === 0 ? ' (mes vencido)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <ResumenCard estado="verde" valor={totales.verde} icon={<CheckCircle2 className="w-5 h-5" />} />
        <ResumenCard estado="amarillo" valor={totales.amarillo} icon={<AlertTriangle className="w-5 h-5" />} />
        <ResumenCard estado="rojo" valor={totales.rojo} icon={<XCircle className="w-5 h-5" />} />
      </div>

      {/* Matriz por empresa */}
      <div className="space-y-3">
        {filas.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">No hay empresas para verificar.</p>
        )}
        {filas.map(({ empresa, celdas, estadoEmpresa }) => (
          <div key={empresa.id} className="border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full ${COLORES[estadoEmpresa].dot}`} />
              <h3 className="font-bold text-[#0A353F] text-sm">{empresa.nombre}</h3>
              <span className={`text-xs ${COLORES[estadoEmpresa].text}`}>· {COLORES[estadoEmpresa].label}</span>
            </div>

            {celdas.length === 0 ? (
              <p className="text-xs text-gray-400">Sin módulos activos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {celdas.map(({ modulo, pdf, editable, estado }) => (
                  <button
                    key={modulo.id}
                    onClick={() => onAbrir?.(empresa.nombre, modulo.nombre)}
                    title={`${modulo.nombre}: ${pdf}/${REQ_PDF} PDF · ${editable}/${REQ_EDITABLE} editables`}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-transform hover:scale-[1.03] ${COLORES[estado].bg} ${COLORES[estado].text}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${COLORES[estado].dot}`} />
                    {modulo.nombre}
                    <span className="opacity-70">({pdf}·{editable})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ResumenCard = ({ estado, valor, icon }) => (
  <div className={`rounded-2xl p-4 flex items-center gap-3 ${COLORES[estado].bg}`}>
    <span className={COLORES[estado].text}>{icon}</span>
    <div>
      <p className={`text-2xl font-bold ${COLORES[estado].text}`}>{valor}</p>
      <p className="text-xs text-gray-500">{COLORES[estado].label}</p>
    </div>
  </div>
);

export default VerificadorEntregas;
