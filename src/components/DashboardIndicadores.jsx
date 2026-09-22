import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Check, X, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { useIndicadores } from '../hooks/useIndicadores';
import { useArchivos } from '../hooks/useArchivos';

const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmt = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
// Resume cifras a millones: $4.883 M. Miles de millones se muestran como MM.
const fmtM = (v) => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return '$' + new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(v/1e12) + ' B';
  if (abs >= 1e9) return '$' + new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(v/1e9) + ' MM';
  return '$' + new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(v/1e6) + ' M';
};
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Inicializar desde la URL (el asistente puede llegar con ?dashEmpresa/dashDesde/dashHasta).
  const [inds, setInds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [extrayendoTodos, setExtrayendoTodos] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [empresaSel, setEmpresaSel] = useState(searchParams.get('dashEmpresa') || 'ALL');
  const [desde, setDesde] = useState(searchParams.get('dashDesde') || '');
  const [hasta, setHasta] = useState(searchParams.get('dashHasta') || '');
  const [modo, setModo] = useState('rango'); // rango | anio | mes (los presets activan comparación)
  const [rangoManual, setRangoManual] = useState(!!(searchParams.get('dashDesde') || searchParams.get('dashHasta')));
  const [tip, setTip] = useState(null); // tooltip del gráfico {x,y,ym,ing,cost}
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const cargar = () => {
    setCargando(true);
    getIndicadores().then((d) => { setInds(d); setCargando(false); })
      .catch((e) => { console.error(e); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  // El asistente puede controlar el dashboard vía la URL (?dashEmpresa/dashDesde/dashHasta).
  useEffect(() => {
    const de = searchParams.get('dashEmpresa');
    const dd = searchParams.get('dashDesde');
    const dh = searchParams.get('dashHasta');
    if (!de && !dd && !dh) return;
    if (de) setEmpresaSel(de);
    if (dd || dh) { setModo('rango'); setRangoManual(true); if (dd) setDesde(dd); if (dh) setHasta(dh); }
    // Limpiar los params para no re-aplicarlos al navegar.
    const next = new URLSearchParams(searchParams);
    ['dashEmpresa','dashDesde','dashHasta'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  // Rango de meses disponibles en los datos.
  const ymsData = useMemo(() => {
    const s = new Set(inds.map((i) => `${i.anio}-${i.mes}`));
    return [...s].sort();
  }, [inds]);

  useEffect(() => {
    if (rangoManual) return; // no pisar un rango elegido por el usuario/asistente
    if (!ymsData.length) {
      const now = new Date();
      const end = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const startI = ymToIdx(end) - 5;
      setDesde(idxToYm(startI)); setHasta(end);
    } else {
      setDesde(ymsData[0]); setHasta(ymsData[ymsData.length-1]);
    }
  }, [ymsData, rangoManual]);

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

  // Flujos (ingresos, costos, recaudo) se ACUMULAN sobre el rango; los stocks
  // (cartera) toman el ultimo balance disponible.
  const sumFlujo = (lista, clave) => {
    let s = 0, hay = false;
    lista.forEach((ym) => { const v = valor(ym, clave); if (v != null) { s += v; hay = true; } });
    return hay ? s : null;
  };
  const stockUlt = (lista, clave) => {
    for (let k = lista.length-1; k >= 0; k--) { const v = valor(lista[k], clave); if (v != null) return v; }
    return null;
  };
  const acumular = (lista) => ({
    ingresos: sumFlujo(lista,'ingresos'), costos: sumFlujo(lista,'costos'), recaudo: sumFlujo(lista,'recaudo'),
    cartera_total: stockUlt(lista,'cartera_total'), cartera_vencida: stockUlt(lista,'cartera_vencida'),
  });

  // Período de comparación según el preset activo.
  const mesesComparacion = useMemo(() => {
    if (modo === 'mes') return meses.length ? [idxToYm(ymToIdx(meses[0]) - 1)] : [];
    if (modo === 'anio') return meses.map((ym) => idxToYm(ymToIdx(ym) - 12));
    return null; // rango manual: sin comparación
  }, [modo, meses]);

  const kpis = useMemo(() => {
    if (!meses.length) return [];
    const cur = acumular(meses);
    const prev = mesesComparacion ? acumular(mesesComparacion) : null;
    const margen = (cur.ingresos!=null && cur.ingresos) ? (cur.ingresos-cur.costos)/cur.ingresos*100 : null;
    const vencPct = (cur.cartera_vencida!=null && cur.cartera_total) ? cur.cartera_vencida/cur.cartera_total*100 : null;
    const pMargen = (prev && prev.ingresos) ? (prev.ingresos-prev.costos)/prev.ingresos*100 : null;
    const pVenc = (prev && prev.cartera_total) ? prev.cartera_vencida/prev.cartera_total*100 : null;

    const card = (lbl, c, p, tipo, goodUp) => {
      const val = c==null ? '—' : (tipo==='pct' ? c.toFixed(1)+'%' : fmtM(c));
      let delta = null, good = 'flat';
      if (p != null && c != null) {
        if (tipo==='pct') { const d=c-p; delta=(d>=0?'+':'')+d.toFixed(1)+' pts'; if(goodUp!=null) good=((d>0)===goodUp)?'pos':(d===0?'flat':'neg'); }
        else if (p !== 0) { const d=(c-p)/Math.abs(p)*100; delta=(d>=0?'▲ ':'▼ ')+Math.abs(d).toFixed(1)+'%'; if(goodUp!=null) good=((d>0)===goodUp)?'pos':(d===0?'flat':'neg'); }
      }
      return { lbl, val, delta, good };
    };
    return [
      card('Ingresos', cur.ingresos, prev?prev.ingresos:null, 'cop', true),
      card('Costos', cur.costos, prev?prev.costos:null, 'cop', false),
      card('Margen', margen, pMargen, 'pct', true),
      card('Cartera total', cur.cartera_total, prev?prev.cartera_total:null, 'cop', null),
      card('Cartera vencida', vencPct, pVenc, 'pct', false),
      card('Recaudo', cur.recaudo, prev?prev.recaudo:null, 'cop', true),
    ];
  }, [idx, meses, mesesComparacion, empresaSel, empresas]);

  const compLabel = modo==='anio' ? 'vs año anterior' : modo==='mes' ? 'vs mes anterior' : '';

  // Ingresos acumulados por empresa en el rango.
  const comparacion = useMemo(() => {
    if (!meses.length) return [];
    return empresas.map((e) => {
      let s = 0, hay = false;
      meses.forEach((ym) => { const v = idx[`${e.nombre}|${ym}|ingresos`]; if (typeof v === 'number') { s += v; hay = true; } });
      return { nombre: e.nombre, ing: hay ? s : 0 };
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

  const ultimoYm = () => ymsData[ymsData.length-1] || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const aplicarPreset = (p) => {
    const last = ultimoYm();
    setRangoManual(true);
    if (p === 'mes') { setDesde(last); setHasta(last); setModo('mes'); }
    else if (p === 'anio') { setDesde(`${last.split('-')[0]}-01`); setHasta(last); setModo('anio'); }
  };
  const cambiarMesManual = (setter) => (e) => { setter(e.target.value); setModo('rango'); setRangoManual(true); };

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
          <div className="flex items-center bg-[#F5F5F7] rounded-xl p-0.5">
            <button onClick={()=>aplicarPreset('anio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo==='anio'?'bg-[#0A353F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Este año</button>
            <button onClick={()=>aplicarPreset('mes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo==='mes'?'bg-[#0A353F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Último mes</button>
          </div>
          <input type="month" value={desde} onChange={cambiarMesManual(setDesde)}
            className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="month" value={hasta} onChange={cambiarMesManual(setHasta)}
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

      {/* KPIs (acumulado del rango) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {kpis.map((k)=>(
          <div key={k.lbl} className="bg-[#F5F5F7] rounded-2xl p-4">
            <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold truncate">{k.lbl}</p>
            <p className="text-lg font-bold text-[#0A353F] mt-1">{k.val}</p>
            <p className={`text-[10px] mt-0.5 h-3 font-semibold ${k.good==='pos'?'text-green-600':k.good==='neg'?'text-red-500':'text-gray-400'}`}>
              {k.delta ? `${k.delta} ${compLabel}` : ''}
            </p>
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
                <text x={pl-8} y={py(maxV*t)+3} textAnchor="end" fontSize="10" fill="#7B8D89" fontFamily="monospace">{fmt(maxV*t/1e6)}M</text>
              </g>
            ))}
            {meses.map((ym,i)=><text key={ym} x={px(i)} y={H-8} textAnchor="middle" fontSize="10" fill="#7B8D89">{MES[(+ym.split('-')[1])-1]}</text>)}
            <path d={path(cost)} fill="none" stroke="#C4703C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={path(ing)} fill="none" stroke="#0097A7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {meses.map((ym,i)=>(
              <g key={'p'+i}>
                <circle cx={px(i)} cy={py(cost[i])} r={tip&&tip.i===i?3.5:2.5} fill="#C4703C" />
                <circle cx={px(i)} cy={py(ing[i])} r={tip&&tip.i===i?3.5:2.5} fill="#0097A7" />
                <rect x={px(i)-(iw/Math.max(meses.length,1)/2)} y={pt} width={iw/Math.max(meses.length,1)} height={ih} fill="transparent"
                  onMouseMove={(e)=>setTip({x:e.clientX,y:e.clientY,i,ym,ing:ing[i],cost:cost[i]})}
                  onMouseLeave={()=>setTip(null)} />
              </g>
            ))}
          </svg>
        )}
      </div>

      {tip && (
        <div style={{position:'fixed',left:tip.x+14,top:tip.y+14,zIndex:50,pointerEvents:'none'}}
          className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
          <p className="font-semibold text-gray-600 mb-1">{ymLabel(tip.ym)}</p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#0097A7'}} />Ingresos</span><b className="font-mono">{fmtM(tip.ing)}</b></p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#C4703C'}} />Costos</span><b className="font-mono">{fmtM(tip.cost)}</b></p>
        </div>
      )}

      {/* Ingresos por empresa (consolidado) */}
      {empresaSel==='ALL' && comparacion.length>0 && (
        <div className="border border-gray-100 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">Ingresos por empresa <span className="font-normal text-gray-400">· acumulado del rango</span></h3>
          <div className="flex flex-col gap-2.5">
            {comparacion.map((r)=>{
              const max = comparacion[0].ing || 1;
              return (
                <button key={r.nombre} onClick={()=>setEmpresaSel(r.nombre)}
                  className="grid items-center gap-3 text-left group" style={{gridTemplateColumns:'130px 1fr auto'}}>
                  <span className="text-xs font-semibold text-gray-600 truncate group-hover:text-[#0097A7]">{r.nombre}</span>
                  <span className="bg-[#EEF3F1] rounded-md h-3.5 overflow-hidden"><span className="block h-full rounded-md" style={{width:`${(r.ing/max*100).toFixed(1)}%`,background:'#0097A7'}} /></span>
                  <span className="font-mono text-xs font-semibold text-[#1d1d1f]">{fmtM(r.ing)}</span>
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
                  <span className="font-mono text-sm text-[#1d1d1f]" title={i.unidad==='%'?'':'$'+fmt(i.valor)}>{i.unidad==='%'? (i.valor+'%') : fmtM(i.valor)}</span>
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
