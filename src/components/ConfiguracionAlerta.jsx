import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { Bell, BellOff, Save, Send } from 'lucide-react';

const client = generateClient();

// Panel de activacion de la alerta mensual de entregas (opt-in). Guarda un
// registro singleton en AlertaEntregas: activo, destinatarios y remitente.
const ConfiguracionAlerta = () => {
  const [registro, setRegistro] = useState(null);
  const [activo, setActivo] = useState(false);
  const [email, setEmail] = useState('');
  const [remitente, setRemitente] = useState('');
  const [diaEnvio, setDiaEnvio] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    client.models.AlertaEntregas.list({ limit: 1 })
      .then((res) => {
        const r = res?.data?.[0];
        if (r) {
          setRegistro(r);
          setActivo(!!r.activo);
          setEmail(r.email || '');
          setRemitente(r.remitente || '');
          setDiaEnvio(r.diaEnvio || 1);
        }
      })
      .catch((e) => console.error('ERROR CARGANDO ALERTA:', e));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMsg('');
    try {
      const datos = {
        activo,
        email: email.trim(),
        remitente: remitente.trim(),
        diaEnvio: Number(diaEnvio) || 1,
        actualizado: new Date().toISOString(),
      };
      const res = registro
        ? await client.models.AlertaEntregas.update({ id: registro.id, ...datos })
        : await client.models.AlertaEntregas.create(datos);

      if (res?.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
      if (res?.data) setRegistro(res.data);
      setMsg('Configuración guardada.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      console.error('ERROR GUARDANDO ALERTA:', e);
      setMsg(`Error: ${e.message || e}`);
    } finally {
      setGuardando(false);
    }
  };

  const enviarPrueba = async () => {
    setProbando(true);
    setMsg('Enviando correo de prueba... (guarda primero si cambiaste algo)');
    try {
      const res = await client.mutations.enviarAlertaPrueba({});
      if (res?.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
      setMsg(res?.data?.mensaje || 'Prueba enviada.');
    } catch (e) {
      console.error('ERROR ENVIANDO PRUEBA:', e);
      setMsg(`Error en prueba: ${e.message || e}`);
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-1">
        {activo ? <Bell className="w-5 h-5 text-[#8CC63F]" /> : <BellOff className="w-5 h-5 text-gray-400" />}
        <h2 className="text-xl font-bold text-[#1d1d1f]">Alerta mensual de entregas</h2>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Envía un correo el día 1 de cada mes con las empresas/módulos que no completaron
        sus entregas del mes vencido. Solo se envía si está activada.
      </p>

      <div className="flex items-center justify-between bg-[#F5F5F7] rounded-2xl px-4 py-3 mb-4">
        <span className="text-sm font-medium text-[#0A353F]">
          {activo ? 'Alerta activada' : 'Alerta desactivada'}
        </span>
        <button
          onClick={() => setActivo((v) => !v)}
          className={`relative w-12 h-7 rounded-full transition-colors ${activo ? 'bg-[#8CC63F]' : 'bg-gray-300'}`}
          aria-label="Activar alerta"
        >
          <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${activo ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#F5F5F7] rounded-xl px-4 py-1">
          <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Destinatarios (separados por coma)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@empresa.com, jefe@empresa.com"
            className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
          />
        </div>
        <div className="bg-[#F5F5F7] rounded-xl px-4 py-1">
          <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Remitente (verificado en SES)</label>
          <input
            value={remitente}
            onChange={(e) => setRemitente(e.target.value)}
            placeholder="alertas@tudominio.com"
            className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
          />
        </div>
      </div>

      <div className="bg-[#F5F5F7] rounded-xl px-4 py-1 mb-4 max-w-xs">
        <label className="text-xs text-gray-500 font-medium uppercase mt-2 block">Día de envío (cada mes)</label>
        <select
          value={diaEnvio}
          onChange={(e) => setDiaEnvio(Number(e.target.value))}
          className="w-full bg-transparent py-2 outline-none text-[#1d1d1f] font-medium text-sm"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>Día {d}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 bg-[#0A353F] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#0A353F]/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={enviarPrueba}
          disabled={probando}
          title="Envia el correo ahora con la configuracion guardada (ignora activacion y dia)"
          className="flex items-center gap-2 bg-[#8CC63F] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#7ab234] transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> {probando ? 'Enviando...' : 'Enviar prueba'}
        </button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  );
};

export default ConfiguracionAlerta;
