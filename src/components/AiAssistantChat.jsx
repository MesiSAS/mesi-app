import { useState, useEffect } from 'react';
import { Bot, Send, X, MessageCircle, FileText, ArrowRight } from 'lucide-react';
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

const AiAssistantChat = ({ user, empresa, modulo, moduloActivo, onNavigate }) => {
  const { askAssistant, getHistorial } = useAiAssistant();
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: `¡Hola, ${getApodo(user?.nombre)}! 👋 Soy tu asistente Mesi. Puedo ayudarte a encontrar tus archivos y a moverte por la plataforma. ¿En qué te ayudo?`,
      sources: [],
    },
  ]);

  // Carga el historial persistido una vez al montar (memoria entre sesiones).
  useEffect(() => {
    if (!user?.id) return;
    let activo = true;
    getHistorial(user.id)
      .then((historial) => {
        if (activo && historial.length) {
          setMessages((prev) => [...prev, ...historial]);
        }
      })
      .catch((err) => console.error('ERROR CARGANDO HISTORIAL:', err));
    return () => { activo = false; };
  }, [user?.id]);

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
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#0A353F] text-white shadow-xl flex items-center justify-center hover:bg-[#0A353F]/90 transition-colors"
        title="Asistente IA"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
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
              {message.sources?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {message.sources.map((source, sourceIndex) => (
                    <div key={`${source.archivoId}-${sourceIndex}`} className="flex items-start gap-2 text-xs text-gray-500">
                      <FileText className="w-3.5 h-3.5 mt-0.5 text-[#8CC63F]" />
                      <span className="min-w-0">
                        <strong className="text-[#0A353F]">{source.nombreArchivo || 'Archivo'}</strong>
                        {source.modulo ? ` - ${source.modulo}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
