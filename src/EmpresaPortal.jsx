import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { FileText, TrendingUp, Users, ShoppingBag, Cpu, BarChart2, Globe, Settings, BookOpen, Briefcase, Scale, ArrowLeft, LogOut } from 'lucide-react';
import ModuloDetalle from './ModuloDetalle';
import { useEmpresas } from './hooks/useEmpresas';
import { useModulos } from './hooks/useModulos';
import { useEmpresaModulos } from './hooks/useEmpresaModulos';

const MODULOS = [
  { title: 'Contabilidad', icon: <FileText className="w-6 h-6" /> },
  { title: 'Finanzas', icon: <TrendingUp className="w-6 h-6" /> },
  { title: 'Talento Humano', icon: <Users className="w-6 h-6" /> },
  { title: 'Compras', icon: <ShoppingBag className="w-6 h-6" /> },
  { title: 'Tecnología', icon: <Cpu className="w-6 h-6" /> },
  { title: 'Legal', icon: <Scale className="w-6 h-6" /> },
];

const ICONOS = { FileText, TrendingUp, Users, ShoppingBag, Cpu, BarChart2, Globe, Settings, BookOpen, Briefcase, Scale,  ArrowLeft, LogOut };

const EmpresaPortal = ({ empresaNombre, onBack }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moduloActivo, setModuloActivo] = useState(null);
  const { getEmpresas } = useEmpresas();
  const {modulos, loadModulos} = useModulos();
  const [empresas, setEmpresas] = useState([]);
  const {empresaModulos, loadEmpresaModulos } = useEmpresaModulos();
  const empresaData = empresas.find(
      e => e.nombre === empresaNombre
  );

  const modulosActivos = empresaModulos.filter(
      em => em.empresaId === empresaData?.id && em.activo
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };


  useEffect(() => {

    const loadData = async () => {

      const empresasData = await getEmpresas();

      setEmpresas(empresasData);

      await loadModulos();

      await loadEmpresaModulos();
    };

    loadData();

  }, []);

  return (
    <>
    {moduloActivo ? (

      <ModuloDetalle
        empresa={empresaNombre}
        modulo={moduloActivo}
        onBack={() => setModuloActivo(null)}
        isAdmin={user?.tipo === 'admin'}
      />

    ) : (

      <div className="min-h-screen bg-[#F5F5F7] font-sans">
      {/* Navbar */}
      <nav className="bg-[#0A353F] px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Panel Admin
          </button>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white" style={{ fontFamily: '"Varela Round", sans-serif' }}>mesi</span>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8CC63F' }}></div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">
            <strong className="text-white">{user?.nombre}</strong>
            <span className="ml-2 text-xs bg-[#8CC63F] text-white px-2 py-0.5 rounded-full">Admin</span>
          </span>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      {/* Header empresa */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {empresaData?.logo && (
            <img
              src={empresaData.logo}
              alt={empresaNombre}
              className="h-12 object-contain"
              onError={e => e.target.style.display = 'none'}
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">{empresaNombre}</h1>
            <p className="text-gray-500 text-sm">Portal Empresarial · Vista Admin</p>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-gray-500 mb-8 text-sm">Selecciona un módulo para ver o subir documentos.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modulos.map((mod) => {

  const Icono = ICONOS[mod.icono] || FileText;

  const activo = modulosActivos.some(
    m => m.moduloId === mod.id
  );

  return (
    <div
      key={mod.id}
      onClick={() => activo && setModuloActivo(mod.nombre)}
      className={`bg-white rounded-3xl p-8 shadow-sm transition-all border ${
        activo
          ? 'cursor-pointer hover:shadow-md border-transparent hover:border-[#8CC63F]/30 group'
          : 'opacity-60 border-gray-200 cursor-not-allowed'
      }`}
    >

      <div className="flex items-center justify-between mb-6">

        <div className={`${
          activo ? 'text-[#8CC63F] group-hover:scale-110' : 'text-gray-400'
        } transition-transform`}>
          <Icono className="w-6 h-6" />
        </div>

        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            activo
              ? 'text-green-500 bg-green-50'
              : 'text-gray-500 bg-gray-100'
          }`}
        >
          {activo ? 'Activo' : 'Inactivo'}
        </span>

      </div>

      <h3 className="text-xl font-bold text-[#1d1d1f] mb-1">
        {mod.nombre}
      </h3>

      <p className="text-gray-400 text-sm">
        {activo
          ? 'Ver y gestionar documentos'
          : 'Módulo desactivado para esta empresa'}
      </p>

    </div>
  );
})}
        </div>
      </div>
    </div>
    )}
    </>
  );
};

export default EmpresaPortal;