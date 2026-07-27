import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageCircle, ArrowRight, Trash2 } from 'lucide-react';
import { useAiAssistant } from '../hooks/useAiAssistant';

// Apodos / diminutivos comunes en espanol para personalizar el saludo.
const APODOS = {
  jose: 'Pepe', francisco: 'Pancho', guillermo: 'Memo', alejandro: 'Ale',
  alejandra: 'Ale', eduardo: 'Lalo', roberto: 'Beto', alberto: 'Beto',
  gabriel: 'Gabo', gabriela: 'Gaby', daniel: 'Dani', daniela: 'Dani',
  manuel: 'Manu', antonio: 'Tono', maria: 'Mari', guadalupe: 'Lupe',
  dolores: 'Lola', ignacio: 'Nacho', enrique: 'Quique', jesus: 'Chucho',
  mercedes: 'Meche', fernando: 'Fer', fernanda: 'Fer', camilo: 'Cami',
  camila: 'Cami', santiago: 'Santi', sebastian: 'Seba', valentina: 'Vale',
  isabel: 'Isa', carlos: 'Carlitos', ricardo: 'Richi', patricia: 'Paty',
  cristina: 'Cris', cristian: 'Cris', andres: 'Andres', andrea: 'Andre',
  nicolas: 'Nico', rafael: 'Rafa', miguel: 'Migue', juan: 'Juanito',
  luis: 'Lucho', diego: 'Dieguito', laura: 'Lau', valeria: 'Vale',
  veronica: 'Vero', monica: 'Moni', sofia: 'Sofi', mateo: 'Mate',
};

const getApodo = (nombreCompleto) => {
  const primer = (nombreCompleto || '').trim().split(/\s+/)[0] || '';
  if (!primer) return '';
  const key = primer
    .toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (APODOS[key]) return APODOS[key];
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
};

const saludoDe = (user) =>
  `¡Hola, ${getApodo(user?.nombre)}! 👋 Soy tu asistente Mesi. Puedo ayudarte a encontrar tus archivos y a moverte por la plataforma. ¿En qué te ayudo?`;

const AiAssistantChat = ({ user, empresa, modulo, moduloActivo, onNavigate }) => {
  const { askAssistant, getHistorial } = useAiAssistant();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const finRef = useRef(null);

  // Popup de bienvenida: una vez por inicio de sesion (se marca en sessionStorage).
  const [showWelcome, setShowWelcome] = useState(() => {
    if (!user?.id) return false;
    return !sessionStorage.getItem(`mesi_welcome_${user.id}`);
  });

  const cerrarWelcome = () => {
    if (user?.id) sessionStorage.setItem(`mesi_welcome_${user.id}`, '1');
    setShowWelcome(false);
  };

  const [messages, setMessages] = useState(() => [
    { role: 'assistant', content: saludoDe(user), sources: [] },
  ]);

  // "Vaciar chat" es solo visual: guarda un corte local; los mensajes siguen
  // en la BD (y el asistente conserva su memoria en el backend).
  const claveCorte = user?.id ? `mesi_chat_cleared_${user.id}` : null;

  // Carga el historial persistido una vez al montar (memoria entre sesiones),
  // omitiendo lo anterior al ultimo "vaciar chat" de este usuario.
  useEffect(() => {
    if (!user?.id) return;
    let activo = true;
    const corte = claveCorte ? localStorage.getItem(claveCorte) : null;
    getHistorial(user.id)
      .then((historial) => {
        const visibles = corte
          ? historial.filter((m) => m.createdAt && m.createdAt > corte)
          : historial;
        if (activo && visibles.length) {
          setMessages((prev) => [...prev, ...visibles]);
        }
      })
      .catch((err) => console.error('ERROR CARGANDO HISTORIAL:', err));
    return () => { activo = false; };
  }, [user?.id]);

  // Siempre mostrar lo mas reciente: al abrir, al llegar mensajes o al cargar historial.
  useEffect(() => {
    if (open) finRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, loading]);

  const vaciarChat = () => {
    if (claveCorte) localStorage.setItem(claveCorte, new Date().toISOString());
    setMessages([{ role: 'assistant', content: saludoDe(user), sources: [] }]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: question, sources: [] }]);

    try {
      const result = await askAssistant({
        userId: user.id,
        message: question,
        empresa,
        modulo,
        moduloActivo,
      });

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: result?.answer || 'No pude generar una respuesta.',
          sources: result?.sources || [],
          action: result?.action || null,
        },
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: error.message || 'No se pudo consultar el asistente.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action) => {
    if (!action || !onNavigate) return;
    onNavigate(action);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {showWelcome && (
          <div className="w-[min(340px,calc(100vw-48px))] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 relative">
            <button
              onClick={cerrarWelcome}
              className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#0A353F] flex items-center justify-center text-white flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0A353F] text-sm">Asistente Mesi</h3>
            </div>
            <p className="text-sm text-[#1d1d1f] leading-relaxed mb-4">{saludoDe(user)}</p>
            <button
              onClick={() => { cerrarWelcome(); setOpen(true); }}
              className="w-full flex items-center justify-center gap-2 bg-[#8CC63F] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#7ab234] transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Abrir chat
            </button>
          </div>
        )}
        <button
          onClick={() => { cerrarWelcome(); setOpen(true); }}
          className="h-14 w-14 rounded-full bg-[#0A353F] text-white shadow-xl flex items-center justify-center hover:bg-[#0A353F]/90 transition-colors"
          title="Asistente IA"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[min(420px,calc(100vw-32px))] h-[620px] max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
      <div className="px-5 py-4 bg-[#0A353F] text-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm">Asistente Mesi</h2>
          <p className="text-xs text-white/70 truncate">{empresa}{modulo ? ` - ${modulo}` : ''}</p>
        </div>
        <button
          onClick={() => {
            if (confirm('¿Vaciar la conversación? El asistente conservará su memoria, pero dejarás de ver los mensajes anteriores.')) vaciarChat();
          }}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          title="Vaciar chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F7]">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              message.role === 'user'
                ? 'bg-[#0A353F] text-white'
                : 'bg-white text-[#1d1d1f]'
            }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.action && onNavigate && (
                <button
                  onClick={() => handleAction(message.action)}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-[#8CC63F] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#7ab234] transition-colors"
                >
                  {message.action.label || 'Ir'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-500 rounded-2xl px-4 py-3 text-sm shadow-sm">
              Pensando...
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          className="flex-1 bg-[#F5F5F7] rounded-xl px-4 py-3 outline-none text-sm text-[#1d1d1f]"
          placeholder="Pregunta por tus archivos..."
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-12 h-12 rounded-xl bg-[#8CC63F] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#7ab234] transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default AiAssistantChat;
