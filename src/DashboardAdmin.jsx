import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LogOut, Building2, Users, Layers, ChevronRight, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, FileText, Database, Bell } from 'lucide-react';
import EmpresaPortal from './EmpresaPortal';
import { Folder } from 'lucide-react';
import { useArchivos } from './hooks/useArchivos';
import VerificadorEntregas from './components/VerificadorEntregas';
import ConfiguracionAlerta from './components/ConfiguracionAlerta';
import { useEmpresas } from './hooks/useEmpresas';
import { useModulos } from './hooks/useModulos';
import { useUsuarios } from './hooks/useUsuarios';
import { useEmpresaModulos } from './hooks/useEmpresaModulos';
import { useSubmodulos } from './hooks/useSubmodulos';

const ICONOS = ['FileText', 'TrendingUp', 'Users', 'ShoppingBag', 'Cpu', 'BarChart2', 'Globe', 'Settings', 'BookOpen', 'Briefcase', 'Scale'];

function ModuloCard({ mod, openModal, handleDelete }) {
  const Icono = ICONOS[mod.icono] || FileText;

  return (

    
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      
      <div className="flex items-center gap-4 p-4 bg-[#F5F5F7]">
        
        {mod.logo ? (
          <img
            src={mod.logo}
            alt={mod.nombre}
            className="h-10 w-10 object-contain rounded-xl bg-white p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#8CC63F]/10 flex items-center justify-center text-[#8CC63F] flex-shrink-0">
            <Icono className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1">
          <p className="font-bold text-[#1d1d1f] text-sm">
            {mod.nombre}
          </p>

          <p className="text-xs text-gray-400">
            {(mod.submodulos || []).length} submódulo(s)
          </p>
        </div>

        <div className="flex items-center gap-1">

          <button
            onClick={() => openModal('modulo', 'edit', mod)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-[#0A353F] transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleDelete('modulo', mod.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

        </div>
      </div>
    </div>
  );
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      <h2 className="text-xl font-bold text-[#1d1d1f] mb-6">{title}</h2>
      {children}
    </div>
  </div>
);

const InputField = ({ label, ...props }) => (
  <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all">
    <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">{label}</label>
    <input className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm" {...props} />
  </div>
);

const SelectField = ({ label, children, ...props }) => (
  <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all">
    <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">{label}</label>
    <select className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm" {...props}>{children}</select>
  </div>
);

const DashboardAdmin = () => {

  const {
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
  } = useEmpresas();

  const {
    getUsuarios,
    createUsuario,
    updateUsuario,
    deleteUsuario,
  } = useUsuarios();

  const {
    modulos,
    loadModulos,
    createModulo,
    updateModulo,
    deleteModulo,
  } = useModulos();

  const {
    empresaModulos,
    loadEmpresaModulos,
    toggleModuloEmpresa,
  } = useEmpresaModulos();

  const {
    submodulos,
    loadSubmodulos,
    addSubmodulo,
    deleteSubmodulo,
  } = useSubmodulos();

  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('empresas');
  const [searchParams, setSearchParams] = useSearchParams();

  // La empresa activa (vista de portal admin) vive en la URL (?empresa=...)
  // para que el historial del navegador controle la navegacion.
  const empresaActiva = searchParams.get('empresa');
  const abrirEmpresa = (nombre) => setSearchParams({ empresa: nombre });
  const cerrarEmpresa = () => navigate(-1);

  // Data state
  const [empresas, setEmpresas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'empresa'|'usuario'|'modulo', mode: 'create'|'edit', data: {} }
  const [form, setForm] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');

  const handleLogout = () => { logout(); navigate('/'); };

  const { reindexarTodos, getAllArchivos } = useArchivos();
  const [indexando, setIndexando] = useState(false);
  const [indexMsg, setIndexMsg] = useState('');
  const [archivosAll, setArchivosAll] = useState([]);

  const abrirEmpresaModulo = (empresaNombre, moduloNombre) => {
    setSearchParams({ empresa: empresaNombre, modulo: moduloNombre });
  };

  const handleReindexar = async () => {
    if (indexando) return;
    if (!confirm('Esto generara los embeddings de TODOS los archivos cargados. Puede tardar varios minutos. Continuar?')) return;
    setIndexando(true);
    setIndexMsg('Indexando archivos... no cierres esta pestana.');
    try {
      const res = await reindexarTodos((hecho, total) => {
        setIndexMsg(`Indexando ${hecho}/${total} archivos...`);
      });
      setIndexMsg(
        `Listo: ${res.archivos} archivos, ${res.conTexto} con texto, ${res.indexados} fragmentos guardados.` +
        (res.fallos ? ` (${res.fallos} fallidos. 1er error: ${res.primerError})` : '')
      );
    } catch (err) {
      console.error('ERROR REINDEXANDO:', err);
      setIndexMsg(`Error al indexar: ${err?.message || err}`);
    } finally {
      setIndexando(false);
    }
  };

  //Loads
  const loadEmpresas = async () => {
      const data = await getEmpresas();

      setEmpresas(Array.isArray(data) ? data : []);
  };

  const loadUsuarios = async () => {
    const data = await getUsuarios();

    setUsuarios(Array.isArray(data) ? data : []);
  };

  useEffect(() => {

    loadEmpresas();
    loadUsuarios();
    loadModulos();
    loadEmpresaModulos();
    loadSubmodulos();
    getAllArchivos().then(setArchivosAll).catch((e) => console.error('ERROR CARGANDO ARCHIVOS (verificador):', e));

  }, []);



  const openModal = (type, mode, data = {}) => {
    setForm(data);
    setFormError('');
    setModal({ type, mode });
  };

  const closeModal = () => { setModal(null); setForm({}); setFormError(''); };

  const handleSave = async () => {

      setFormError('');

      if (modal.type === 'empresa') {

        if (!form.nombre?.trim()) {
          setFormError('El nombre es obligatorio.');
          return;
        }

        if (modal.mode === 'create') {

          await createEmpresa({
            nombre: form.nombre.trim(),
            logo: form.logo?.trim() || '',
          });

        } else {

          await updateEmpresa(form.id, {
            nombre: form.nombre.trim(),
            logo: form.logo?.trim() || '',
          });
        }

        await loadEmpresas();
      }

      if (modal.type === 'usuario') {
        if (!form.nombre?.trim() || !form.correo?.trim() || !form.empresa) {
          setFormError('Nombre, correo y empresa son obligatorios.');
          return;
        }

        if (modal.mode === 'create' && !form.password?.trim()) {
          setFormError('La contraseña es obligatoria.');
          return;
        }

        if (modal.mode === 'create') {

          await createUsuario({
            nombre: form.nombre.trim(),
            correo: form.correo.trim(),
            empresa: form.empresa,
            tipo: form.tipo || 'user',
            password: form.password.trim()
          });

        } else {

          const data = {
            nombre: form.nombre.trim(),
            correo: form.correo.trim(),
            empresa: form.empresa,
            tipo: form.tipo
          };

          if (form.password?.trim()) {
            data.password = form.password.trim();
          }

          await updateUsuario(form.id, data);
        }

        await loadUsuarios();
      }

      if (modal.type === 'modulo') {
        if (!form.nombre?.trim()) {
          setFormError('El nombre es obligatorio.');
          return;
        }

        if (modal.mode === 'create') {

          await createModulo({
            nombre: form.nombre.trim(),
            icono: form.icono || 'FileText'
          });

        } else {

          await updateModulo(form.id, {
            nombre: form.nombre.trim(),
            icono: form.icono || 'FileText'
          });
        }

        await loadModulos();
      }

    closeModal();
  };

  const handleDelete = async (type, id) => {

      if (!confirm('¿Eliminar este elemento?')) return;

      if (type === 'empresa') {

        await deleteEmpresa(id);

        await loadEmpresas();
      }

      if (type === 'usuario') {

       await deleteUsuario(id);

       await loadUsuarios();
      }

      if (type === 'modulo') {

        await deleteModulo(id);

        await loadModulos();
      }
    };

  

  const tabs = [
    { key: 'empresas', label: 'Empresas', icon: <Building2 className="w-4 h-4" />, count: empresas.length },
    { key: 'usuarios', label: 'Usuarios', icon: <Users className="w-4 h-4" />, count: usuarios.length },
    { key: 'modulos', label: 'Módulos', icon: <Layers className="w-4 h-4" />, count: modulos.length },
    { key: 'alertas', label: 'Alertas', icon: <Bell className="w-4 h-4" />, count: empresas.length },
  ];

  return (
    <>
    {empresaActiva ? (

      <EmpresaPortal
        empresaNombre={empresaActiva}
        onBack={cerrarEmpresa}
      />

    ) : (

      <div className="min-h-screen bg-[#F5F5F7] font-sans">
      {/* Navbar */}
      <nav className="bg-[#0A353F] px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white" style={{ fontFamily: '"Varela Round", sans-serif' }}>mesi</span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8CC63F' }}></div>
          <span className="text-white/50 text-xs ml-2 font-medium uppercase tracking-wider">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleReindexar}
            disabled={indexando}
            title="Generar embeddings de los archivos existentes"
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            <Database className="w-4 h-4" /> {indexando ? 'Indexando...' : 'Indexar archivos'}
          </button>
          <span className="text-sm text-white/70"><strong className="text-white">{user?.nombre}</strong></span>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-[#1d1d1f] mb-2">Panel de Administración</h1>
        <p className="text-gray-500 mb-8">Gestiona empresas, usuarios y módulos de Mesi.</p>
        <div className="bg-white rounded-3xl p-6 shadow-sm mt-8">
  <h2 className="text-xl font-bold text-[#1d1d1f] mb-6" >Panel de Reportes</h2>

</div>
  <div className="w-full rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%', position: 'relative', height: 0 }}>
    <iframe
      title="Data HR - PowerBI - 12022026 - V1"
      src="https://app.powerbi.com/reportEmbed?reportId=1ef9e7e4-fdbd-4051-a893-1eeeaa1dbc80&autoAuth=true&ctid=06d757d5-8b3d-41bb-b39a-22a519f7140d"
      frameBorder="0"
      allowFullScreen={true}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', paddingBottom: 30 }}
    />
  </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {tabs.map(t => (
            <div key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-2xl p-6 shadow-sm cursor-pointer transition-all ${tab === t.key ? 'bg-[#0A353F] text-white' : 'bg-white hover:shadow-md'}`}>
              <div className={tab === t.key ? 'text-[#8CC63F]' : 'text-[#8CC63F]'}>{t.icon}</div>
              <p className={`text-3xl font-bold mt-2 ${tab === t.key ? 'text-white' : 'text-[#0A353F]'}`}>{t.count}</p>
              <p className={`text-sm ${tab === t.key ? 'text-white/70' : 'text-gray-500'}`}>{t.label}</p>
            </div>
          ))}
        </div>
      



        {/* Tab: Alertas */}
        {tab === 'alertas' && (
          <>
            <VerificadorEntregas
              empresas={empresas}
              modulos={modulos}
              empresaModulos={empresaModulos}
              archivos={archivosAll}
              onAbrir={abrirEmpresaModulo}
            />
            <ConfiguracionAlerta />
          </>
        )}

        {/* Tab: Empresas */}
        {tab === 'empresas' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#1d1d1f]">Empresas Cliente</h2>
              <button onClick={() => openModal('empresa', 'create')}
                className="flex items-center gap-2 bg-[#0A353F] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0A353F]/90 transition-colors">
                <Plus className="w-4 h-4" /> Nueva Empresa
              </button>
            </div>
            <div className="space-y-3">
              {empresas.map(emp => (
                <div key={emp.id} className="flex items-center gap-4 p-4 bg-[#F5F5F7] rounded-2xl group">
                  <img src={emp.logo} alt={emp.nombre} className="h-8 w-16 object-contain" onError={e => e.target.style.display = 'none'} />
                  <div className="flex-1">
                    <p className="font-bold text-[#1d1d1f]">{emp.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => abrirEmpresa(emp.nombre)}
                      className="flex items-center gap-1 text-xs text-[#0071e3] hover:underline font-medium px-2 py-1">
                      Ver portal <ChevronRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => openModal('empresa', 'edit', emp)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-[#0A353F] transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete('empresa', emp.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Usuarios */}
        {tab === 'usuarios' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#1d1d1f]">Usuarios</h2>
              <button onClick={() => openModal('usuario', 'create', { tipo: 'user' })}
                className="flex items-center gap-2 bg-[#0A353F] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0A353F]/90 transition-colors">
                <Plus className="w-4 h-4" /> Nuevo Usuario
              </button>
            </div>
            <div className="space-y-3">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 bg-[#F5F5F7] rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-[#0A353F] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {u.nombre.split(' ').map(n => n?.[0] || '').slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1d1d1f] text-sm">{u.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{u.correo} · {u.empresa}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.tipo === 'admin' ? 'bg-[#0A353F] text-white' : 'bg-green-50 text-green-600'}`}>
                    {u.tipo === 'admin' ? 'Admin' : 'Usuario'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openModal('usuario', 'edit', u)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-[#0A353F] transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete('usuario', u.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Módulos */}
        {tab === 'modulos' && (
  <div className="bg-white rounded-3xl p-8 shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h2 className="text-xl font-bold text-[#1d1d1f]">Módulos</h2>
      <button onClick={() => openModal('modulo', 'create', { icono: 'FileText' })}
        className="flex items-center gap-2 bg-[#0A353F] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0A353F]/90 transition-colors">
        <Plus className="w-4 h-4" /> Nuevo Módulo
      </button>
    </div>
    <p className="text-xs text-gray-400 mb-6">Los módulos nuevos se activan en todas las empresas por defecto.</p>
    
    <div className="space-y-4">
      {modulos.map(mod => {
        const Icono = ICONOS[mod.icono] || FileText;
        return (
          <div key={mod.id} className="border border-gray-100 rounded-2xl overflow-hidden">
            {/* Módulo header */}
            <div className="flex items-center gap-4 p-4 bg-[#F5F5F7]">
              {mod.logo ? (
                <img src={mod.logo} alt={mod.nombre} className="h-10 w-10 object-contain rounded-xl bg-white p-1" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#8CC63F]/10 flex items-center justify-center text-[#8CC63F] flex-shrink-0">
                  <Icono className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-[#1d1d1f] text-sm">{mod.nombre}</p>
                <p className="text-xs text-gray-400">{(mod.submodulos || []).length} submódulo(s)</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openModal('modulo', 'edit', mod)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-[#0A353F] transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete('modulo', mod.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Submódulos */}
            <div className="px-4 pb-4 pt-2 space-y-2">

              {submodulos
              .filter(sub => sub.moduloId === mod.id)
              .map(sub => (
                <div
                  key={sub.id}
                  className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-gray-100"
                >
                  <Folder className="w-4 h-4 text-[#8CC63F]" />

                  <span className="flex-1 text-sm text-[#1d1d1f]">
                    {sub.nombre}
                  </span>

                  <button
                    onClick={async () => {

                      await deleteSubmodulo(sub.id);

                      await loadSubmodulos();
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
            ))}

              {/* Agregar submódulo */}
              <SubmoduloInput
                moduloId={mod.id}
                onAdd={loadSubmodulos}
                addSubmodulo={addSubmodulo}
              />

            </div>

            {/* Activación por empresa */}
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 font-medium uppercase mb-2">Activo en empresas</p>
              <div className="flex flex-wrap gap-2">
                {empresas.map(emp => {
                  const relacion = empresaModulos.find(
                    r =>
                      r.empresaId === emp.id &&
                      r.moduloId === mod.id
                  );

                  const activo = relacion
                    ? relacion.activo
                    : true;

                  return (
                    <button
                      key={`${emp.id}-${mod.id}`}
                      onClick={async () => {

                        await toggleModuloEmpresa(
                          emp.id,
                          mod.id,
                          !activo
                        );

                        await loadEmpresaModulos();
                      }}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        activo
                          ? 'bg-[#8CC63F] text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {activo ? '✓' : '○'} {emp.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={`${modal.mode === 'create' ? 'Crear' : 'Editar'} ${modal.type === 'empresa' ? 'Empresa' : modal.type === 'usuario' ? 'Usuario' : 'Módulo'}`}
          onClose={closeModal}
        >
          <div className="space-y-4">
            {/* Empresa form */}
            {modal.type === 'empresa' && (<>
    <InputField
        label="Nombre de la empresa"
        value={form.nombre || ''}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
        placeholder="Ej: Empresa S.A.S."
    />

    {/* Upload logo */}
    <div>
        <label className="text-xs text-gray-500 font-medium uppercase block mb-2">Logo de la empresa</label>
        <div
        onClick={() => document.getElementById('logo-upload').click()}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-[#8CC63F] hover:bg-[#8CC63F]/5 transition-all group"
        >
        {form.logo ? (
            <div className="flex flex-col items-center gap-3">
            <img src={form.logo} alt="Logo" className="h-16 object-contain" />
            <p className="text-xs text-gray-400">Clic para cambiar</p>
            </div>
        ) : (
            <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-[#8CC63F]/10 transition-colors">
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#8CC63F]" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Seleccionar imagen</p>
            <p className="text-xs text-gray-400">PNG, JPG, SVG, WEBP</p>
            </div>
        )}
        </div>
        <input
        id="logo-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setForm({ ...form, logo: ev.target.result });
            reader.readAsDataURL(file);
        }}
        />
    </div>
</>)}

            {/* Usuario form */}
            {modal.type === 'usuario' && (<>
              <InputField label="Nombre completo" value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre Apellido" />
              <InputField label="Correo corporativo" type="email" value={form.correo || ''} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="nombre@empresa.com" />
              <SelectField label="Empresa" value={form.empresa || ''} onChange={e => setForm({ ...form, empresa: e.target.value })}>
                <option value="">Seleccionar empresa</option>
                {[...empresas, { id: 'mesi', nombre: 'Mesi' }].map(e => (
                  <option key={e.id} value={e.nombre}>{e.nombre}</option>
                ))}
              </SelectField>
              <SelectField label="Tipo de usuario" value={form.tipo || 'user'} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </SelectField>
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all">
                <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">
                  {modal.mode === 'edit' ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                </label>
                <div className="flex items-center">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password || ''}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="flex-1 bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>)}

            {/* Módulo form */}
            {modal.type === 'modulo' && (<>
  <InputField label="Nombre del módulo" value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Jurídico" />
  <SelectField label="Icono" value={form.icono || 'FileText'} onChange={e => setForm({ ...form, icono: e.target.value })}>
    {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
  </SelectField>
  {/* Logo del módulo */}
  <div>
    <label className="text-xs text-gray-500 font-medium uppercase block mb-2">Logo del módulo (opcional)</label>
    <div onClick={() => document.getElementById('modulo-logo-upload').click()}
      className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-[#8CC63F] transition-all">
      {form.logo ? (
        <img src={form.logo} alt="Logo" className="h-12 object-contain mx-auto" />
      ) : (
        <p className="text-sm text-gray-400">Clic para seleccionar imagen</p>
      )}
      <input id="modulo-logo-upload" type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => setForm({ ...form, logo: ev.target.result });
          reader.readAsDataURL(file);
        }} />
    </div>
  </div>
</>)}

            {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all hover:scale-[1.01]" style={{ backgroundColor: '#0A353F' }}>
                <Check className="w-4 h-4 inline mr-1" /> {modal.mode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    )}
    {indexMsg && (
      <div className="fixed bottom-6 left-6 z-50 max-w-sm bg-[#0A353F] text-white text-sm px-4 py-3 rounded-xl shadow-xl">
        {indexMsg}
        <button onClick={() => setIndexMsg('')} className="ml-3 text-white/60 hover:text-white">×</button>
      </div>
    )}
    </>
  );
};


const SubmoduloInput = ({ moduloId, onAdd, addSubmodulo }) => {

  const [valor, setValor] = useState('');

  const handleAdd = async () => {

    if (!valor.trim()) return;

    await addSubmodulo(valor.trim(), moduloId);

    setValor('');

    onAdd();
  };

  return (
    <div className="flex gap-2 mt-1">

      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Nuevo submódulo..."
        className="flex-1 bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm outline-none text-[#1d1d1f] border border-transparent focus:border-[#8CC63F] transition-colors"
      />

      <button
        onClick={handleAdd}
        className="px-3 py-2 bg-[#0A353F] text-white rounded-xl text-sm font-medium hover:bg-[#0A353F]/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>

    </div>
  );
};

export default DashboardAdmin;
