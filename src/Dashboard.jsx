import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import {
  LogOut,
  FileText,
  TrendingUp,
  Users,
  ShoppingBag,
  Cpu,
  KeyRound,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import ModuloDetalle from './ModuloDetalle';
import { useEmpresas } from './hooks/useEmpresas';
import { useModulos } from './hooks/useModulos';
import { useEmpresaModulos } from './hooks/useEmpresaModulos';

const ICONOS = { FileText, TrendingUp, Users, ShoppingBag, Cpu };

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, changePassword } = useAuth();
  const { getEmpresas } = useEmpresas();
  const { loadModulos } = useModulos();
  const { loadEmpresaModulos } = useEmpresaModulos();

  const [empresaData, setEmpresaData] = useState(null);
  const [modulos, setModulos] = useState([]);
  const [modulosActivos, setModulosActivos] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // El modulo activo vive en la URL (?modulo=...) para que el historial del
  // navegador (botones atras/adelante) controle la navegacion de forma nativa.
  const moduloActivo = searchParams.get('modulo');

  // Abrir un modulo agrega una entrada al historial -> habilita el boton "atras".
  const abrirModulo = (nombre) => setSearchParams({ modulo: nombre });
  // Cerrar usa navigate(-1) para comportarse identico al boton atras del navegador.
  const cerrarModulo = () => navigate(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPw, setShowPw] = useState({ actual: false, nueva: false, confirmar: false });

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.empresa) return;

      setLoading(true);
      setError('');

      try {
        const [empresasData, modulosData, empresaModulosData] = await Promise.all([
          getEmpresas(),
          loadModulos(),
          loadEmpresaModulos(),
        ]);

        const empresaActual = empresasData.find(
          empresa => empresa.nombre === user.empresa
        );

        if (!empresaActual) {
          setEmpresaData(null);
          setModulos([]);
          setModulosActivos([]);
          setError('No se encontro la empresa asociada a tu usuario.');
          return;
        }

        setEmpresaData(empresaActual);
        setModulos(modulosData);
        setModulosActivos(
          empresaModulosData.filter(
            relacion =>
              relacion.empresaId === empresaActual.id &&
              relacion.activo
          )
        );
      } catch (err) {
        console.error('ERROR CARGANDO DASHBOARD:', err);
        setEmpresaData(null);
        setModulos([]);
        setModulosActivos([]);
        setError('No se pudo cargar la informacion del portal.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [getEmpresas, loadEmpresaModulos, loadModulos, user?.empresa]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');

    if (pwData.actual !== user.password) {
      setPwError('La contrasena actual es incorrecta.');
      return;
    }

    if (pwData.nueva.length < 6) {
      setPwError('La nueva contrasena debe tener al menos 6 caracteres.');
      return;
    }

    if (pwData.nueva !== pwData.confirmar) {
      setPwError('Las contrasenas no coinciden.');
      return;
    }

    try {
      await changePassword(pwData.nueva);
      setPwSuccess('Contrasena actualizada correctamente.');
      setPwData({ actual: '', nueva: '', confirmar: '' });
      setTimeout(() => {
        setPwSuccess('');
        setShowPasswordModal(false);
      }, 2000);
    } catch (err) {
      console.error('ERROR CAMBIANDO CONTRASENA:', err);
      setPwError('No se pudo actualizar la contrasena.');
    }
  };

  if (moduloActivo) {
    return (
      <ModuloDetalle
        empresa={user?.empresa}
        modulo={moduloActivo}
        onBack={cerrarModulo}
        isAdmin={false}
      />
    );
  }

  const modulosDisponibles = modulos.filter((modulo) =>
    modulosActivos.some(relacion => relacion.moduloId === modulo.id)
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold" style={{ fontFamily: '"Varela Round", sans-serif', color: '#0A353F' }}>mesi</span>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8CC63F' }} />
          </div>
          {user?.logo && (
            <img
              src={user.logo}
              alt={user.empresa}
              className="h-8 object-contain opacity-80"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Bienvenido, <strong className="text-[#0A353F]">{user?.nombre}</strong></span>
          <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A353F] transition-colors">
            <KeyRound className="w-4 h-4" /> Contrasena
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A353F] transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {(empresaData?.logo || user?.logo) && (
            <img
              src={empresaData?.logo || user.logo}
              alt={user?.empresa}
              className="h-12 object-contain"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">{user?.empresa}</h1>
            <p className="text-gray-500 text-sm">Portal Empresarial - Servicios Mesi</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-gray-500 mb-8 text-sm">Selecciona un modulo para ver tus documentos disponibles.</p>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm text-center text-gray-500">
            Cargando informacion...
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm text-center text-red-500">
            {error}
          </div>
        ) : modulosDisponibles.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm text-center text-gray-500">
            No tienes modulos activos por el momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modulosDisponibles.map((modulo) => {
              const Icono = ICONOS[modulo.icono] || FileText;

              return (
                <div
                  key={modulo.id}
                  onClick={() => abrirModulo(modulo.nombre)}
                  className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-[#8CC63F]/30"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-[#8CC63F] group-hover:scale-110 transition-transform">
                      <Icono className="w-6 h-6" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-[#1d1d1f] mb-1">
                    {modulo.nombre}
                  </h3>

                  <p className="text-gray-400 text-sm">
                    Ver documentos disponibles
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 relative">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPwError('');
                setPwSuccess('');
                setPwData({ actual: '', nueva: '', confirmar: '' });
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-[#1d1d1f] mb-2">Cambiar Contrasena</h2>
            <p className="text-gray-500 text-sm mb-6">Actualiza tu contrasena de acceso al portal.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { key: 'actual', label: 'Contrasena actual' },
                { key: 'nueva', label: 'Nueva contrasena' },
                { key: 'confirmar', label: 'Confirmar nueva contrasena' },
              ].map(({ key, label }) => (
                <div key={key} className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all relative">
                  <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">{label}</label>
                  <div className="flex items-center">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pwData[key]}
                      onChange={e => setPwData({ ...pwData, [key]: e.target.value })}
                      className="flex-1 bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
                      placeholder="********"
                    />
                    <button type="button" onClick={() => setShowPw({ ...showPw, [key]: !showPw[key] })} className="text-gray-400 hover:text-gray-600">
                      {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {pwError && <p className="text-red-500 text-sm text-center">{pwError}</p>}
              {pwSuccess && <p className="text-green-500 text-sm text-center">OK {pwSuccess}</p>}
              <button type="submit" className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.01]" style={{ backgroundColor: '#0A353F' }}>
                Actualizar Contrasena
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
