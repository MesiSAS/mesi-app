import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useUsuarios } from './hooks/useUsuarios';
import { 
  Menu, X, ChevronRight, Calculator, FileText, Cpu, ShoppingBag,
  Users, ArrowRight, Target, ShieldCheck,
  Scale
} from 'lucide-react';

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { getUsuarios } = useUsuarios();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const colors = {
    primary: "#0A353F",
    accent: "#8CC63F",
    bg: "#F5F5F7",
    text: "#1d1d1f"
  };

  const services = [
    { title: "Contabilidad", desc: "Precisión financiera.", icon: <Calculator className="w-8 h-8" /> },
    { title: "Finanzas", desc: "Estrategia de capital.", icon: <FileText className="w-8 h-8" /> },
    { title: "Tecnología", desc: "Infraestructura sin límites.", icon: <Cpu className="w-8 h-8" /> },
    { title: "Compras", desc: "Cadena de suministro optimizada.", icon: <ShoppingBag className="w-8 h-8" /> },
    { title: "Talento Humano", desc: "Cultura y bienestar.", icon: <Users className="w-8 h-8" /> },
    { title: "Legal", desc: "Asesoría Jurídica.", icon: <Scale className="w-8 h-8" /> }
  ];

  const handleLogin = async (e) => {
  e.preventDefault();
  setLoginError('');

  try {
    const usuarios = await getUsuarios();
    const found = usuarios.find(
      usuario =>
        usuario.correo === loginData.email &&
        usuario.password === loginData.password
    );

    if (found) {
      login(found);
      setIsLoginOpen(false);
      setLoginError('');
      navigate(found.tipo === 'admin' ? '/admin' : `/dashboard/${encodeURIComponent(found.empresa)}`);
    } else {
      setLoginError('Correo o contraseña incorrectos.');
    }
  } catch (error) {
    console.error('ERROR INICIANDO SESION:', error);
    setLoginError('No se pudo validar el usuario.');
  }
};

  return (
    <div className="font-sans text-[#1d1d1f] bg-white selection:bg-[#8CC63F] selection:text-white">

      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-[980px] mx-auto px-4 lg:px-0">
          <div className="flex justify-between items-center h-12">
            <a href="#" className="flex items-center gap-1 group">
              <span className="text-xl font-bold tracking-tight opacity-90 group-hover:opacity-100 transition-opacity" style={{ fontFamily: '"Varela Round", sans-serif', color: colors.primary }}>
                mesi
              </span>
              <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: colors.accent }}></div>
            </a>
            <div className="hidden md:flex items-center space-x-6 text-xs font-medium tracking-wide text-gray-600">
              <a href="#servicios" className="hover:text-[#0A353F] transition-colors">Servicios</a>
              <a href="#proposito" className="hover:text-[#0A353F] transition-colors">Propósito</a>
              <a href="#empresa" className="hover:text-[#0A353F] transition-colors">Empresa</a>
              <button
                onClick={() => setIsLoginOpen(true)}
                className="border border-[#0A353F] text-[#0A353F] px-3 py-1 rounded-full hover:bg-[#0A353F] hover:text-white transition-colors text-xs font-medium"
              >
                Login
              </button>
              <a href="#contacto" className="bg-[#1d1d1f] text-white px-3 py-1 rounded-full hover:bg-[#0A353F] transition-colors">
                Contacto
              </a>
            </div>
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-800 focus:outline-none">
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden bg-white absolute w-full h-screen z-40 px-8 py-4">
            <div className="space-y-6 text-2xl font-semibold text-[#1d1d1f]">
              <a href="#servicios" onClick={() => setIsMenuOpen(false)} className="block border-b border-gray-100 pb-2">Servicios</a>
              <a href="#proposito" onClick={() => setIsMenuOpen(false)} className="block border-b border-gray-100 pb-2">Propósito</a>
              <button onClick={() => { setIsMenuOpen(false); setIsLoginOpen(true); }} className="block text-[#0A353F]">Login</button>
              <a href="#contacto" onClick={() => setIsMenuOpen(false)} className="block text-[#0A353F]">Contacto</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-48 md:pb-32 text-center px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-10 bg-gradient-to-r from-[#0A353F]/10 to-[#8CC63F]/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
              <div className="flex items-center gap-4 relative">
                <span className="text-8xl md:text-9xl font-bold tracking-tighter" style={{ fontFamily: '"Varela Round", sans-serif', color: colors.primary }}>
                  mesi
                </span>
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full mt-4 animate-pulse" style={{ backgroundColor: colors.accent }}></div>
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-[#1d1d1f]">Respaldo Total.</h1>
          <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
            Centralizamos tus servicios operativos con precisión estratégica. <br/>
            <span style={{ color: colors.primary }} className="font-semibold">Para que tú solo lideres.</span>
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
            <a href="#contacto" className="group flex items-center gap-2 bg-[#0071e3] text-white px-6 py-3 rounded-full text-base font-medium hover:bg-[#0077ED] transition-all">
              Empezar ahora <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#proposito" className="flex items-center gap-2 text-[#0071e3] hover:underline text-base font-medium">
              Ver cómo funciona <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="py-24 bg-[#F5F5F7]">
        <div className="max-w-[980px] mx-auto px-4 lg:px-0">
          <div className="mb-12 text-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Servicios Integrados.</h2>
            <p className="text-xl text-gray-500 font-medium">Todo al mismo nivel de excelencia.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <div key={index} className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center h-64 group cursor-default border border-transparent hover:border-[#8CC63F]/20">
                <div className="mb-6 transform group-hover:scale-110 transition-transform duration-300">
                  {React.cloneElement(service.icon, { className: "w-12 h-12 text-[#8CC63F]" })}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#1d1d1f]">{service.title}</h3>
                <p className="font-medium text-lg leading-snug text-gray-500">{service.desc}</p>
                <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 text-[#0071e3] flex items-center text-sm font-semibold">
                  Saber más <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Propósito */}
      <section id="proposito" className="py-32 bg-black text-white overflow-hidden">
        <div className="max-w-[980px] mx-auto px-4 lg:px-0 text-center">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Liderazgo vs. Operación.
          </h2>
          <p className="text-2xl md:text-3xl font-medium text-gray-400 max-w-3xl mx-auto mb-16 leading-normal">
            Los líderes pierden el <span className="text-white">40% de su tiempo</span> en tareas operativas. Mesi invierte esa ecuación.
          </p>
          <div className="grid md:grid-cols-2 gap-8 text-left mt-16">
            <div className="bg-[#1c1c1e] p-10 rounded-3xl group hover:bg-[#2c2c2e] transition-colors">
              <Target className="w-12 h-12 text-[#8CC63F] mb-6" />
              <h3 className="text-3xl font-bold mb-4">Para Gerentes</h3>
              <p className="text-gray-400 text-lg mb-8">Deja de apagar incendios diarios. Recupera tu agenda estratégica.</p>
              <span className="text-white font-bold text-xl block">"Mientras tú lideras el futuro, nosotros sostenemos el presente."</span>
            </div>
            <div className="bg-[#1c1c1e] p-10 rounded-3xl group hover:bg-[#2c2c2e] transition-colors">
              <ShieldCheck className="w-12 h-12 text-[#0A353F] mb-6" fill="white" />
              <h3 className="text-3xl font-bold mb-4">Para Equipos</h3>
              <p className="text-gray-400 text-lg mb-8">Procesos claros, herramientas correctas y soporte constante.</p>
              <span className="text-white font-bold text-xl block">"Respaldo real, para trabajo real."</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="py-24 bg-white">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.accent }}></div>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-4 text-[#1d1d1f]">Conversemos.</h2>
          <p className="text-lg text-gray-500 mb-10">Un café virtual para entender tus necesidades y mostrarte cómo podemos ayudar.</p>
          <form className="space-y-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0071e3] transition-all">
                <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Nombre</label>
                <input type="text" className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium" placeholder="Tu nombre" />
              </div>
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0071e3] transition-all">
                <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Empresa</label>
                <input type="text" className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium" placeholder="Tu empresa" />
              </div>
            </div>
            <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0071e3] transition-all">
              <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Correo</label>
              <input type="email" className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium" placeholder="nombre@empresa.com" />
            </div>
            <button className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-[1.01] shadow-lg hover:shadow-xl" style={{ backgroundColor: colors.primary }}>
              Solicitar Propuesta
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#F5F5F7] text-xs text-gray-500 py-10 border-t border-gray-200">
        <div className="max-w-[980px] mx-auto px-4 lg:px-0">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <span className="text-xl font-bold tracking-tighter text-[#1d1d1f]" style={{ fontFamily: '"Varela Round", sans-serif' }}>mesi</span>
              <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: colors.accent }}></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 w-full md:w-auto">
              <div>
                <h4 className="font-semibold text-[#1d1d1f] mb-2">Servicios</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:underline">Contabilidad</a></li>
                  <li><a href="#" className="hover:underline">Finanzas</a></li>
                  <li><a href="#" className="hover:underline">Tecnología</a></li>
                  <li><a href="#" className="hover:underline">Compras</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#1d1d1f] mb-2">Empresa</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:underline">Sobre Nosotros</a></li>
                  <li><a href="#" className="hover:underline">Carreras</a></li>
                  <li><a href="#" className="hover:underline">Contacto</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-300 pt-4 flex flex-col md:flex-row justify-between items-center">
            <p>Copyright © {new Date().getFullYear()} Mesi S.A.S. Todos los derechos reservados.</p>
            <div className="flex space-x-4 mt-2 md:mt-0">
              <a href="#" className="hover:underline">Privacidad</a>
              <span className="text-gray-300">|</span>
              <a href="#" className="hover:underline">Términos</a>
            </div>
          </div>
          <p className="mt-4 text-[10px] text-gray-400">
            Mesi es una marca registrada en Colombia. Los valores expresados en las propuestas comerciales son en Pesos Colombianos (COP).
          </p>
        </div>
      </footer>

      {/* Modal Login */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md mx-4 relative">
            <button
              onClick={() => { setIsLoginOpen(false); setLoginError(''); setLoginData({ email: '', password: '' }); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-3xl font-bold" style={{ fontFamily: '"Varela Round", sans-serif', color: '#0A353F' }}>mesi</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8CC63F' }}></div>
              </div>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">Acceso Empresas</h2>
              <p className="text-gray-500 text-sm mt-1">Ingresa con tus credenciales corporativas</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all">
                <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Correo corporativo</label>
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium"
                  placeholder="nombre@empresa.com"
                />
              </div>
              <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-[#0A353F] transition-all">
                <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Contraseña</label>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium"
                  placeholder="••••••••"
                />
              </div>
              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-[1.01]"
                style={{ backgroundColor: '#0A353F' }}
              >
                Ingresar
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                ¿Olvidaste tu contraseña? <a href="#" className="text-[#0A353F] underline">Contáctanos</a>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
