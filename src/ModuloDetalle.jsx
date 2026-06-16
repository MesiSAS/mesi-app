import { useState, useRef, useEffect } from 'react';
import { useArchivos } from './hooks/useArchivos';
import { useModulos } from './hooks/useModulos';
import { useSubmodulos } from './hooks/useSubmodulos';
import {
  ArrowLeft, Upload, FileText, Trash2, Download,
  Filter, Calendar, FolderOpen, ChevronDown, ChevronRight,
  EyeOff, Eye, Folder, X
} from 'lucide-react';

const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];
const anioS = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
const getMesLabel = (value) => MESES.find(m => m.value === value)?.label || value;
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const agruparPorFecha = (archivos) => {
  const grupos = {};

  archivos.forEach(arch => {
    const key = `${arch.anio}__${arch.mes}`;

    if (!grupos[key]) {
      grupos[key] = {
        anio: arch.anio,
        mes: arch.mes,
        archivos: []
      };
    }

    grupos[key].archivos.push(arch);
  });

  return Object.values(grupos).sort((a, b) => {
    if (b.anio !== a.anio) return b.anio.localeCompare(a.anio);
    return b.mes.localeCompare(a.mes);
  });
};

const base64ToBlobUrl = (base64, mimeType = 'application/pdf') => {
  try {
    const byteCharacters = atob(base64.split(',')[1]);

    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);

    const blob = new Blob([byteArray], {
      type: mimeType
    });

    return URL.createObjectURL(blob);

  } catch {
    return null;
  }
};

const ModuloDetalle = ({ empresa, modulo, onBack, isAdmin}) => {
  const {
    saveArchivo,
    getArchivosFiltrados,
    deleteArchivo,
    downloadArchivo,
    toggleOculto
  } = useArchivos();

  const {
    modulos,
    loadModulos
  } = useModulos();

  const {
    submodulos,
    loadSubmodulos
  } = useSubmodulos();

  const [submoduloActivo, setSubmoduloActivo] = useState(null);

  useEffect(() => {

    loadModulos();
    loadSubmodulos();

  }, []);

  const nombreModuloBase = modulo.includes('__')
  ? modulo.split('__')[0]
  : modulo;

  const moduloData = modulos.find(
    m => m.nombre === nombreModuloBase
  );

  const submodulosDelModulo = submodulos.filter(
    s => s.moduloId === moduloData?.id
  );

  // Upload
  const [uploadanio, setUploadanio] = useState(String(new Date().getFullYear()));
  const [uploadMes, setUploadMes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef();

  // Filter
  const [filtroanio, setFiltroanio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // La clave de almacenamiento incluye submódulo si aplica
  const contexto = submoduloActivo ? `${modulo}__${submoduloActivo}` : modulo;
  const [archivos, setArchivos] = useState([]);
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [previewArchivo, setPreviewArchivo] = useState(null);

  const refreshArchivos = async (anio = filtroanio, mes = filtroMes) => {
    const data = await getArchivosFiltrados(
      empresa,
      contexto,
      anio,
      mes,
      isAdmin
    );

    setArchivos(data || []);
  };

  useEffect(() => {
    const load = async () => {
      await refreshArchivos();
    };

    load();
  }, [contexto]);
  // Si cambia el submódulo, refresca
  const handleSubmodulo = async (nombre) => {
    setSubmoduloActivo(nombre);
    const data = await getArchivosFiltrados(
      empresa,
      nombre ? `${modulo}__${nombre}` : modulo,
      '',
      '',
      isAdmin
    );

    setArchivos(data || []);
  };
  const nombreVista = submoduloActivo || modulo;
  const toggleGrupo = (key) => setGruposExpandidos(prev => ({ ...prev, [key]: !prev[key] }));

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!uploadMes) { setUploadError('Selecciona el mes antes de subir.'); return; }
    setUploading(true); setUploadError('');
    try {
      for (const file of files) await saveArchivo(empresa, contexto, uploadanio, uploadMes, file);
      setUploadSuccess(`${files.length} archivo(s) subido(s).`);
      setTimeout(() => setUploadSuccess(''), 4000);
      refreshArchivos();
    } catch { setUploadError('Error al subir. El archivo puede ser demasiado grande (+5MB).'); }
    setUploading(false);
    fileRef.current.value = '';
  };

  const handleDelete = async (arch) => {
    if (!confirm('¿Eliminar este archivo?')) return;

    await deleteArchivo(
      empresa,
      contexto,
      arch.anio,
      arch.mes,
      arch.id,
      arch.s3Key
    );

    refreshArchivos();
  };

  const handleToggleOculto = async (anio, mes, id) => {
    // Optimista: voltear el estado local de inmediato para que la animacion
    // ocurra al instante al hacer clic, sin esperar al backend.
    setArchivos(prev =>
      prev.map(a => (a.id === id ? { ...a, oculto: !a.oculto } : a))
    );

    try {
      await toggleOculto(empresa, contexto, anio, mes, id);
    } catch (error) {
      console.error('ERROR TOGGLE OCULTO:', error);
      // Revertir si el backend falla.
      setArchivos(prev =>
        prev.map(a => (a.id === id ? { ...a, oculto: !a.oculto } : a))
      );
    }
  };

  const grupos = agruparPorFecha(archivos);


  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => { if (submoduloActivo) { setSubmoduloActivo(null); refreshArchivos(); } else { onBack();}
  }} className="flex items-center gap-2 text-gray-500 hover:text-[#0A353F] transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <h2 className="font-bold text-[#0A353F] text-lg">{nombreVista}</h2>
        <span className="text-gray-400 text-sm">· {empresa}</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Submódulos */}
        {submoduloActivo === null && submodulosDelModulo.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5 text-[#8CC63F]" /> Submódulos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {submodulosDelModulo.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubmodulo(sub.nombre)}
                  className="flex items-center gap-3 p-4 bg-[#F5F5F7] rounded-2xl hover:bg-[#8CC63F]/10 hover:border-[#8CC63F]/30 border border-transparent transition-all text-left"
                >
                  <Folder className="w-5 h-5 text-[#8CC63F] flex-shrink-0" />
                  <span className="font-medium text-[#1d1d1f] text-sm">{sub.nombre}</span>
                </button>
                
              ))}
            </div>
          </div>
        )}

        {/* Subir archivos — solo admin */}
        {isAdmin && (
          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#8CC63F]" /> Subir Documentos
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase block mb-2">anio</label>
                <select value={uploadanio} onChange={e => setUploadanio(e.target.value)}
                  className="w-full bg-[#F5F5F7] rounded-xl px-4 py-3 outline-none text-[#1d1d1f] font-medium text-sm">
                  {anioS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase block mb-2">Mes <span className="text-red-400">*</span></label>
                <select value={uploadMes} onChange={e => setUploadMes(e.target.value)}
                  className="w-full bg-[#F5F5F7] rounded-xl px-4 py-3 outline-none text-[#1d1d1f] font-medium text-sm">
                  <option value="">Seleccionar mes</option>
                  {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div onClick={() => !uploading && fileRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all group
                ${uploading ? 'border-[#8CC63F] bg-[#8CC63F]/5 cursor-wait' : 'border-gray-200 hover:border-[#8CC63F] hover:bg-[#8CC63F]/5'}`}>
              <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${uploading ? 'text-[#8CC63F] animate-bounce' : 'text-gray-300 group-hover:text-[#8CC63F]'}`} />
              <p className="text-gray-500 font-medium">{uploading ? 'Subiendo...' : 'Haz clic para seleccionar archivos'}</p>
              <p className="text-gray-400 text-xs mt-1">PDF, Excel, Word · Máx. 5MB</p>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
            </div>
            {uploadSuccess && <div className="mt-4 bg-green-50 text-green-600 rounded-xl px-4 py-3 text-sm font-medium text-center">✓ {uploadSuccess}</div>}
            {uploadError && <div className="mt-4 bg-red-50 text-red-500 rounded-xl px-4 py-3 text-sm font-medium text-center">✗ {uploadError}</div>}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#8CC63F]" /> Filtrar Documentos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase block mb-2">anio</label>
              <select value={filtroanio} onChange={e => setFiltroanio(e.target.value)}
                className="w-full bg-[#F5F5F7] rounded-xl px-4 py-3 outline-none text-[#1d1d1f] font-medium text-sm">
                <option value="">Todos</option>
                {anioS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase block mb-2">Mes</label>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
                className="w-full bg-[#F5F5F7] rounded-xl px-4 py-3 outline-none text-[#1d1d1f] font-medium text-sm">
                <option value="">Todos</option>
                {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => refreshArchivos(filtroanio, filtroMes)}
                className="flex-1 bg-[#0A353F] text-white rounded-xl px-4 py-3 font-medium text-sm hover:bg-[#0A353F]/90 transition-colors flex items-center justify-center gap-2">
                <Filter className="w-4 h-4" /> Filtrar
              </button>
              <button onClick={() => { setFiltroanio(''); setFiltroMes(''); refreshArchivos('', ''); }}
                className="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#8CC63F]" /> Documentos
            <span className="ml-auto text-sm font-normal text-gray-400">{archivos.length} archivo(s)</span>
          </h3>
          {grupos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay documentos</p>
              <p className="text-sm mt-1">{isAdmin ? 'Sube el primer documento arriba.' : 'Aún no hay documentos disponibles.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grupos.map((grupo) => {
                const key = `${grupo.anio}__${grupo.mes}`;
                const expandido = gruposExpandidos[key] !== false;
                return (
                  <div key={key} className="border border-gray-100 rounded-2xl overflow-hidden">
                    <button onClick={() => toggleGrupo(key)}
                      className="w-full flex items-center justify-between px-6 py-4 bg-[#F5F5F7] hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[#8CC63F]" />
                        <span className="font-bold text-[#0A353F]">{getMesLabel(grupo.mes)} {grupo.anio}</span>
                        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                          {grupo.archivos.length} archivo(s)
                        </span>
                      </div>
                      {expandido ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandido && (
                      <div className="divide-y divide-gray-50">
                        {grupo.archivos.map((arch) => (
                          <div key={arch.id}
                            className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group ${arch.oculto ? 'opacity-50' : ''}`}>
                            <div className="w-10 h-10 bg-[#F5F5F7] rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-[#0A353F]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[#1d1d1f] text-sm truncate">{arch.nombre}</p>
                                {arch.oculto && (
                                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                                    <EyeOff className="w-3 h-3" /> Oculto
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatSize(arch.tamano)} · {new Date(arch.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setPreviewArchivo(arch)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#0A353F] hover:bg-[#0A353F]/10 transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => downloadArchivo(arch)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#0A353F] hover:bg-[#0A353F]/10 transition-colors"
                                title="Descargar"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {isAdmin && (<>
                                <button onClick={() => handleToggleOculto(arch.anio, arch.mes, arch.id)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${arch.oculto ? 'text-[#8CC63F] hover:bg-[#8CC63F]/10' : 'text-gray-400 hover:bg-gray-100'}`}
                                  title={arch.oculto ? 'Mostrar al usuario' : 'Ocultar al usuario'}>
                                  {arch.oculto ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDelete(arch)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Eliminar">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {previewArchivo && (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
    
    <div className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-[#1d1d1f]">
            {previewArchivo.nombre}
          </h3>

          <p className="text-sm text-gray-400 mt-1">
            {formatSize(previewArchivo.tamano)}
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => downloadArchivo(previewArchivo)}
            className="px-4 py-2 rounded-xl bg-[#0A353F] text-white text-sm font-medium hover:bg-[#0A353F]/90 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar
          </button>

          <button
            onClick={() => setPreviewArchivo(null)}
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-gray-100">

        {previewArchivo.tipo?.includes('pdf') ? (

  <iframe
    src={previewArchivo?.url}
    className="w-full h-[80vh] rounded-2xl"
    title={previewArchivo.nombre}
  />

) : previewArchivo.tipo?.includes('image') ? (

          <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
            <img
              src={previewArchivo?.url}
              alt={previewArchivo.nombre}
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>

        ) : (

          <div className="w-full h-full flex flex-col items-center justify-center text-center p-10">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />

            <h4 className="text-lg font-bold text-[#1d1d1f] mb-2">
              Vista previa no disponible
            </h4>

            <p className="text-gray-500 text-sm mb-6">
              Este tipo de archivo no puede visualizarse directamente.
            </p>

            <button
              onClick={() => downloadArchivo(previewArchivo)}
              className="px-5 py-3 rounded-xl bg-[#0A353F] text-white text-sm font-medium hover:bg-[#0A353F]/90 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar archivo
            </button>
          </div>

        )}

      </div>

    </div>

  </div>
)}
      </div>
    </div>
  );
};

export default ModuloDetalle;