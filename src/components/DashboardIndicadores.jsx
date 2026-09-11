import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, X, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { useIndicadores } from '../hooks/useIndicadores';
import { useArchivos } from '../hooks/useArchivos';

const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmt = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
const ymLabel = (ym) => { const [a,m]=ym.split('-'); return `${MES[(+m)-1]} ${a}`; };
const ymToIdx = (ym) => { const [a,m]=ym.split('-').map(Number); return a*12+(m-1); };
const idxToYm = (i) => `${Math.floor(i/12)}-${String((i%12)+1).padStart(2,'0')}`;

const CLAVE_LBL = {
  ingresos:'Ingresos', costos:'Costos', cartera_total:'Cartera total',
  cartera_vencida:'Cartera vencida', recaudo:'Recaudo',
};

const DashboardIndicadores = ({ empresas = [] }) => {
  const { getIndicadores, confirmarIndicador, editarValor, eliminarIndicador, extraer } = useIndicadores();
  const { getAllArchivos } = useArchivos();
  const [inds, setInds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [extrayendoTodos, setExtrayendoTodos] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [empresaSel, setEmpresaSel] = useState('ALL');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const cargar = () => {
    setCargando(true);
    getIndicadores().then((d) => { setInds(d); setCargando(false); })
      .catch((e) => { console.error(e); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  // Rango de meses disponibles en los datos.
  const ymsData = useMemo(() => {
    const s = new Set(inds.map((i) => `${i.anio}-${i.mes}`));
    return [...s].sort();
  }, [inds]);

  useEffect(() => {
    if (!ymsData.length) {
      const now = new Date();
      const end = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const startI = ymToIdx(end) - 5;
      setDesde(idxToYm(startI)); setHasta(end);
    } else {
      setDesde(ymsData[0]); setHasta(ymsData[ymsData.length-1]);
    }
  }, [ymsData]);

  // Indice: empresa|ym|clave -> valor
  const idx = useMemo(() => {
    const m = {};
    inds.forEach((i) => { m[`${i.empresa}|${i.anio}-${i.mes}|${i.clave}`] = i.valor; });
    return m;
  }, [inds]);

  const meses = useMemo(() => {
    if (!desde || !hasta) return [];
    let s = ymToIdx(desde), e = ymToIdx(hasta);
    if (s > e) [s,e] = [e,s];
    const out = [];
    for (let i=s; i<=e && out.length<36; i++) out.push(idxToYm(i));
    return out;
  }, [desde, hasta]);

  const empresasActivas = empresaSel === 'ALL' ? empresas.map((e)=>e.nombre) : [empresaSel];

  const valor = (ym, clave) => {
    let suma = 0, hay = false;
    empresasActivas.forEach((en) => {
      const v = idx[`${en}|${ym}|${clave}`];
      if (typeof v === 'number') { suma += v; hay = true; }
    });
    return hay ? suma : null;
  };

  const serie = (clave) => meses.map((ym) => valor(ym, clave) ?? 0);

  // Ultimo mes (dentro del rango) con dato para una clave, en el scope actual.
  const latest = (clave) => {
    for (let k = meses.length-1; k >= 0; k--) { const v = valor(meses[k], clave); if (v != null) return { ym: meses[k], v }; }
    return { ym: null, v: null };
  };
  const latestPair = (a, b) => {
    for (let k = meses.length-1; k >= 0; k--) { const va = valor(meses[k], a), vb = valor(meses[k], b); if (va != null && vb != null) return { ym: meses[k], a: va, b: vb }; }
    return null;
  };

  // KPIs con el valor mas reciente disponible por clave (no un mes fijo vacio).
  const kpis = useMemo(() => {
    if (!meses.length) return [];
    const ing = latest('ingresos'), cost = latest('costos'), cart = latest('cartera_total'), rec = latest('recaudo');
    const mp = latestPair('ingresos','costos');
    const margen = mp && mp.a ? (mp.a - mp.b)/mp.a*100 : null;
    const vp = latestPair('cartera_total','cartera_vencida');
    const vencPct = vp && vp.a ? vp.b/vp.a*100 : null;
    const sub = (x) => x && x.ym ? ymLabel(x.ym) : '';
    return [
      { lbl:'Ingresos', txt: ing.v==null?'—':'$'+fmt(ing.v), sub: sub(ing) },
      { lbl:'Costos', txt: cost.v==null?'—':'$'+fmt(cost.v), sub: sub(cost) },
      { lbl:'Margen', txt: margen==null?'—':margen.toFixed(1)+'%', sub: mp?ymLabel(mp.ym):'' },
      { lbl:'Cartera total', txt: cart.v==null?'—':'$'+fmt(cart.v), sub: sub(cart) },
      { lbl:'Cartera vencida', txt: vencPct==null?'—':vencPct.toFixed(1)+'%', sub: vp?ymLabel(vp.ym):'' },
      { lbl:'Recaudo', txt: rec.v==null?'—':'$'+fmt(rec.v), sub: sub(rec) },
    ];
  }, [idx, meses, empresaSel, empresas]);

  // Comparación de ingresos por empresa (valor mas reciente en el rango).
  const comparacion = useMemo(() => {
    if (!meses.length) return [];
    return empresas.map((e) => {
      let ing = null;
      for (let k = meses.length-1; k >= 0; k--) { const v = idx[`${e.nombre}|${meses[k]}|ingresos`]; if (typeof v === 'number') { ing = v; break; } }
      return { nombre: e.nombre, ing: ing || 0 };
    }).filter((r) => r.ing > 0).sort((a,b) => b.ing - a.ing);
  }, [idx, meses, empresas]);

  const porConfirmar = useMemo(() =>
    inds.filter((i) => i.estado === 'por_confirmar' && (empresaSel==='ALL' || i.empresa===empresaSel))
        .sort((a,b)=> (a.empresa+a.anio+a.mes).localeCompare(b.empresa+b.anio+b.mes)),
  [inds, empresaSel]);

  // Extracción masiva (primera carga): recorre TODOS los archivos con
  // concurrencia limitada; cada llamada individual cabe en el límite de AppSync.
  const extraerTodos = async () => {
    if (extrayendoTodos) return;
    if (!confirm('Se intentará extraer indicadores de TODOS los archivos con IA. Puede tardar varios minutos y no debes cerrar esta pestaña. ¿Continuar?')) return;
    setExtrayendoTodos(true);
    setProgreso('Cargando lista de archivos...');
    try {
      const archivos = await getAllArchivos();
      let hecho = 0, conIndicadores = 0, fallos = 0;
      const CONC = 4;
      for (let i = 0; i < archivos.length; i += CONC) {
        const lote = archivos.slice(i, i + CONC);
        await Promise.all(lote.map(async (a) => {
          try {
            const r = await extraer(a.id);
            if ((r?.creados || 0) + (r?.actualizados || 0) > 0) conIndicadores += 1;
          } catch (e) { fallos += 1; console.error('extraer', a.nombre, e); }
          finally { hecho += 1; }
        }));
        setProgreso(`Procesando ${hecho}/${archivos.length} archivos · ${conIndicadores} con indicadores${fallos ? ` · ${fallos} fallidos` : ''}`);
      }
      setProgreso(`Listo: ${archivos.length} archivos procesados, ${conIndicadores} aportaron indicadores. Revisa "Por confirmar".`);
      cargar();
    } catch (e) {
      console.error(e); setProgreso(`Error: ${e.message || e}`);
    } finally {
      setExtrayendoTodos(false);
    }
  };

  const [confirmandoTodos, setConfirmandoTodos] = useState(false);
  const onConfirmarTodos = async () => {
    if (confirmandoTodos || !porConfirmar.length) return;
    if (!confirm(`¿Confirmar ${porConfirmar.length} indicador(es)?`)) return;
    setConfirmandoTodos(true);
    try {
      const items = porConfirmar.slice();
      const CONC = 8;
      for (let i = 0; i < items.length; i += CONC) {
        await Promise.all(items.slice(i, i + CONC).map((it) => confirmarIndicador(it.id).catch((e) => console.error('confirmar', e))));
      }
      cargar();
    } finally {
      setConfirmandoTodos(false);
    }
  };

  const onConfirmar = async (i) => { try { await confirmarIndicador(i.id); cargar(); } catch(e){ alert(e.message); } };
  const onGuardarEdit = async (i) => { try { await editarValor(i.id, editVal); setEditId(null); cargar(); } catch(e){ alert(e.message); } };
  const onEliminar = async (i) => { if(!confirm('¿Descartar este indicador?'))return; await eliminarIndicador(i.id); cargar(); };

  // Line chart (ingresos vs costos)
  const ing = serie('ingresos'), cost = serie('costos');
  const hayFinanciero = ing.some(v=>v>0) || cost.some(v=>v>0);
  const maxV = Math.max(1, ...ing, ...cost);
  const W=560,H=220,pl=52,pr=14,pt=12,pb=26,iw=W-pl-pr,ih=H-pt-pb;
  const px=(i)=> meses.length<2 ? pl+iw/2 : pl + i/(meses.length-1)*iw;
  const py=(v)=> pt+ih-(v/maxV)*ih;
  const path=(arr)=> arr.map((v,i)=>`${i?'L':'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#8CC63F]" />
          <h2 className="text-xl font-bold text-[#1d1d1f]">Dashboard {empresaSel==='ALL' ? '· Consolidado' : '· '+empresaSel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={empresaSel} onChange={(e)=>setEmpresaSel(e.target.value)}
            className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none cursor-pointer">
            <option value="ALL">Todas las empresas</option>
            {empresas.map((e)=><option key={e.id} value={e.nombre}>{e.nombre}</option>)}
          </select>
          <input type="month" value={desde} onChange={(e)=>setDesde(e.target.value)}
            className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="month" value={hasta} onChange={(e)=>setHasta(e.target.value)}
            className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none" />
          <button onClick={extraerTodos} disabled={extrayendoTodos}
            title="Extraer indicadores de todos los archivos (primera carga)"
            className="flex items-center gap-2 bg-[#8CC63F] text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[#7ab234] transition-colors disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {extrayendoTodos ? 'Extrayendo...' : 'Extraer de todos'}
          </button>
          <button onClick={cargar} title="Recargar" className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {progreso && (
        <div className="mb-5 bg-[#0A353F] text-white text-sm px-4 py-3 rounded-xl flex items-center gap-3">
          {extrayendoTodos && <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />}
          <span className="flex-1">{progreso}</span>
          {!extrayendoTodos && <button onClick={() => setProgreso('')} className="text-white/60 hover:text-white">×</button>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {kpis.map((k)=>(
          <div key={k.lbl} className="bg-[#F5F5F7] rounded-2xl p-4">
            <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold truncate">{k.lbl}</p>
            <p className="text-lg font-bold text-[#0A353F] mt-1">{k.txt}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 h-3">{k.sub || ''}</p>
          </div>
        ))}
      </div>

      {/* Gráfico Ingresos vs Costos */}
      <div className="border border-gray-100 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">Ingresos vs Costos</h3>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#0097A7'}} />Ingresos</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#C4703C'}} />Costos</span>
          </div>
        </div>
        {!hayFinanciero ? (
          <p className="text-gray-400 text-sm text-center py-10">Sin datos financieros en el rango. Extrae de los archivos o carga un Excel.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {[0,0.25,0.5,0.75,1].map((t)=>(
              <g key={t}>
                <line x1={pl} y1={py(maxV*t)} x2={W-pr} y2={py(maxV*t)} stroke="#EEF3F1" />
                <text x={pl-8} y={py(maxV*t)+3} textAnchor="end" fontSize="10" fill="#7B8D89" fontFamily="monospace">{fmt(maxV*t)}</text>
              </g>
            ))}
            {meses.map((ym,i)=><text key={ym} x={px(i)} y={H-8} textAnchor="middle" fontSize="10" fill="#7B8D89">{MES[(+ym.split('-')[1])-1]}</text>)}
            <path d={path(cost)} fill="none" stroke="#C4703C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={path(ing)} fill="none" stroke="#0097A7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Ingresos por empresa (consolidado) */}
      {empresaSel==='ALL' && comparacion.length>0 && (
        <div className="border border-gray-100 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">Ingresos por empresa</h3>
          <div className="flex flex-col gap-2.5">
            {comparacion.map((r)=>{
              const max = comparacion[0].ing || 1;
              return (
                <button key={r.nombre} onClick={()=>setEmpresaSel(r.nombre)}
                  className="grid items-center gap-3 text-left group" style={{gridTemplateColumns:'130px 1fr auto'}}>
                  <span className="text-xs font-semibold text-gray-600 truncate group-hover:text-[#0097A7]">{r.nombre}</span>
                  <span className="bg-[#EEF3F1] rounded-md h-3.5 overflow-hidden"><span className="block h-full rounded-md" style={{width:`${(r.ing/max*100).toFixed(1)}%`,background:'#0097A7'}} /></span>
                  <span className="font-mono text-xs font-semibold text-[#1d1d1f]">${fmt(r.ing)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Por confirmar */}
      <div>
        <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">
          Por confirmar {porConfirmar.length>0 && <span className="ml-1 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">{porConfirmar.length}</span>}
        </h3>
        {porConfirmar.length>0 && (
          <button onClick={onConfirmarTodos} disabled={confirmandoTodos}
            className="flex items-center gap-2 bg-[#0A353F] text-white rounded-xl px-3 py-2 text-xs font-semibold hover:bg-[#0A353F]/90 transition-colors disabled:opacity-50">
            <Check className="w-3.5 h-3.5" /> {confirmandoTodos ? 'Confirmando...' : `Confirmar todos (${porConfirmar.length})`}
          </button>
        )}
        </div>
        {cargando ? (
          <p className="text-gray-400 text-sm">Cargando…</p>
        ) : porConfirmar.length===0 ? (
          <p className="text-gray-400 text-sm">Nada por confirmar. Los indicadores extraídos de los archivos aparecerán aquí para tu revisión.</p>
        ) : (
          <div className="space-y-2">
            {porConfirmar.map((i)=>(
              <div key={i.id} className="flex items-center gap-3 bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#0A353F]">{i.empresa}</span>
                  <span className="text-xs text-gray-400"> · {ymLabel(`${i.anio}-${i.mes}`)} · {CLAVE_LBL[i.clave]||i.clave}</span>
                </div>
                {editId===i.id ? (
                  <input autoFocus value={editVal} onChange={(e)=>setEditVal(e.target.value)}
                    className="w-32 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono" />
                ) : (
                  <span className="font-mono text-sm text-[#1d1d1f]">{i.unidad==='%'? (i.valor+'%') : '$'+fmt(i.valor)}</span>
                )}
                {editId===i.id ? (
                  <button onClick={()=>onGuardarEdit(i)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8CC63F] hover:bg-white" title="Guardar"><Check className="w-4 h-4" /></button>
                ) : (
                  <button onClick={()=>{setEditId(i.id); setEditVal(String(i.valor));}} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white" title="Editar"><Pencil className="w-4 h-4" /></button>
                )}
                <button onClick={()=>onConfirmar(i)} className="flex items-center gap-1 bg-[#8CC63F] text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[#7ab234]" title="Confirmar"><Check className="w-3.5 h-3.5" /> Confirmar</button>
                <button onClick={()=>onEliminar(i)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" title="Descartar"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardIndicadores;
