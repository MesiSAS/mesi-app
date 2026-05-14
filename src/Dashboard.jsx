import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { getModulos } from './data/db';
import { LogOut, FileText, TrendingUp, Users, ShoppingBag, Cpu, KeyRound, X, Eye, EyeOff } from 'lucide-react';
import ModuloDetalle from './ModuloDetalle';
import { getModulosActivos } from './data/db';
const modulos = getModulos();

const ICONOS = { FileText, TrendingUp, Users, ShoppingBag, Cpu };

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, changePassword } = useAuth();
  const [moduloActivo, setModuloActivo] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPw, setShowPw] = useState({ actual: false, nueva: false, confirmar: false });

  const modulos = getModulosActivos(user?.empresa);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setPwError('');
    if (pwData.actual !== user.password) { setPwError('La contraseña actual es incorrecta.'); return; }
    if (pwData.nueva.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (pwData.nueva !== pwData.confirmar) { setPwError('Las contraseñas no coinciden.'); return; }
    changePassword(pwData.nueva);
    setPwSuccess('Contraseña actualizada correctamente.');
    setPwData({ actual: '', nueva: '', confirmar: '' });
    setTimeout(() => { setPwSuccess(''); setShowPasswordModal(false); }, 2000);
  };

  if (moduloActivo) {
    return <ModuloDetalle empresa={user?.empresa} modulo={moduloActivo} onBack={() => setModuloActivo(null)} isAdmin={false} />;
  }

  const IconoModulo = ({ nombre }) => {
    const m = modulos.find(m => m.nombre === nombre);
    const Icono = m ? (ICONOS[m.icono] || FileText) : FileText;
    return <Icono className="w-6 h-6" />;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      {/* Navbar */}
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold" style={{ fontFamily: '"Varela Round", sans-serif', color: '#0A353F' }}>mesi</span>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8CC63F' }}></div>
          </div>
          {user?.logo && <img src={user.logo} alt={user.empresa} className="h-8 object-contain opacity-80" onError={e => e.target.style.display = 'none'} />}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Bienvenido, <strong className="text-[#0A353F]">{user?.nombre}</strong></span>
          <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A353F] transition-colors">
            <KeyRound className="w-4 h-4" /> Contraseña
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A353F] transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      {/* Header empresa */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {user?.logo && <img src={user.logo} alt={user.empresa} className="h-12 object-contain" onError={e => e.target.style.display = 'none'} />}
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">{user?.empresa}</h1>
            <p className="text-gray-500 text-sm">Portal Empresarial · Servicios Mesi</p>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-gray-500 mb-8 text-sm">Selecciona un módulo para ver tus documentos.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modulos.map((mod) => {
            const Icono = ICONOS[mod.icono] || FileText;
            return (
              <div key={mod.id} onClick={() => setModuloActivo(mod.nombre)}
                className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-[#8CC63F]/30">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-[#8CC63F] group-hover:scale-110 transition-transform"><Icono className="w-6 h-6" /></div>
                </div>
                <h3 className="text-xl font-bold text-[#1d1d1f] mb-1">{mod.nombre}</h3>
                <p className="text-gray-400 text-sm">Ver documentos disponibles</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal cambio de contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 relative">
            <button onClick={() => { setShowPasswordModal(false); setPwError(''); setPwSuccess(''); setPwData({ actual: '', nueva: '', confirmar: '' }); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-[#1d1d1f] mb-2">Cambiar Contraseña</h2>
            <p className="text-gray-500 text-sm mb-6">Actualiza tu contraseña de acceso al portal.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { key: 'actual', label: 'Contraseña actual' },
                { key: 'nueva', label: 'Nueva contraseña' },
                { key: 'confirmar', label: 'Confirmar nueva contraseña' },
              ].map(({ key, label }) => (
                <div key={key} className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all relative">
                  <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">{label}</label>
                  <div className="flex items-center">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pwData[key]}
                      onChange={e => setPwData({ ...pwData, [key]: e.target.value })}
                      className="flex-1 bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPw({ ...showPw, [key]: !showPw[key] })} className="text-gray-400 hover:text-gray-600">
                      {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {pwError && <p className="text-red-500 text-sm text-center">{pwError}</p>}
              {pwSuccess && <p className="text-green-500 text-sm text-center">✓ {pwSuccess}</p>}
              <button type="submit" className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.01]" style={{ backgroundColor: '#0A353F' }}>
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;