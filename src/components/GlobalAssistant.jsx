import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AiAssistantChat from './AiAssistantChat';

// Monta el asistente una sola vez a nivel global, para que este disponible en
// todas las vistas y conserve su estado al navegar. Deriva el contexto
// (empresa, modulo) desde la URL para que sepa donde esta el usuario.
const GlobalAssistant = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Solo dentro de las areas autenticadas.
  const enArea = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');
  if (!user || !enArea) return null;

  // Admin: la empresa del param ?empresa, o ninguna (= acceso a todas).
  // Usuario normal: siempre su propia empresa (el backend igual lo fuerza).
  const esAdmin = user.tipo === 'admin';
  const empresa = esAdmin ? (searchParams.get('empresa') || null) : user.empresa;
  const moduloActivo = searchParams.get('modulo') || null;

  const handleNavigate = (action) => {
    if (!action?.moduloNombre) return;
    const next = new URLSearchParams(searchParams);
    next.set('modulo', action.moduloNombre);
    // Limpiar contexto previo y aplicar el nuevo (submodulo y archivo destino).
    next.delete('submodulo');
    next.delete('archivo');
    if (action.submodulo) next.set('submodulo', action.submodulo);
    if (action.type === 'open_file' && action.archivoId) next.set('archivo', action.archivoId);
    setSearchParams(next);
  };

  return (
    <AiAssistantChat
      key={user.id}
      user={user}
      empresa={empresa}
      moduloActivo={moduloActivo}
      onNavigate={handleNavigate}
    />
  );
};

export default GlobalAssistant;
