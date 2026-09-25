import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Check, X, Pencil, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useIndicadores } from '../hooks/useIndicadores';
import { useArchivos } from '../hooks/useArchivos';

const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmt = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
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
  headcount:'Headcount', entradas:'Entradas de personal', salidas:'Salidas de personal',
};

const FLUJOS = ['ingresos','costos','recaudo']; // se acumulan en modo Totales
const CLAVES_CALC = ['ingresos','costos','recaudo','cartera_total','cartera_vencida','headcount','entradas','salidas'];

const DashboardIndicadores = ({ empresas = [] }) => {
  const { getIndicadores, confirmarIndicador, editarValor, eliminarIndicador, extraer } = useIndicadores();
  const { getAllArchivos } = useArchivos();
  const [searchParams, setSearchParams] = useSearchParams();

  const [inds, setInds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [extrayendoTodos, setExtrayendoTodos] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [empresaSel, setEmpresaSel] = useState(searchParams.get('dashEmpresa') || 'ALL');
  const [desde, setDesde] = useState(searchParams.get('dashDesde') || '');
  const [hasta, setHasta] = useState(searchParams.get('dashHasta') || '');
  const [modo, setModo] = useState('rango');        // rango | anio | mes (presets → comparación)
  const [modoAgg, setModoAgg] = useState('total');  // total | promedio (el switch)
  const [rangoManual, setRangoManual] = useState(!!(searchParams.get('dashDesde') || searchParams.get('dashHasta')));
  const [tip, setTip] = useState(null);
  const [tipP, setTipP] = useState(null);          // tooltip del gráfico de personal
  const [mostrarFlujos, setMostrarFlujos] = useState(true); // ver/ocultar entradas y salidas
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [confirmandoTodos, setConfirmandoTodos] = useState(false);

  const cargar = () => {
    setCargando(true);
    getIndicadores().then((d) => { setInds(d); setCargando(false); })
      .catch((e) => { console.error(e); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  // El asistente controla el dashboard vía la URL (?dashEmpresa/dashDesde/dashHasta).
  useEffect(() => {
    const de = searchParams.get('dashEmpresa'), dd = searchParams.get('dashDesde'), dh = searchParams.get('dashHasta');
    if (!de && !dd && !dh) return;
    if (de) setEmpresaSel(de);
    if (dd || dh) { setModo('rango'); setRangoManual(true); if (dd) setDesde(dd); if (dh) setHasta(dh); }
    const next = new URLSearchParams(searchParams);
    ['dashEmpresa','dashDesde','dashHasta'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  const ymsData = useMemo(() => [...new Set(inds.map((i) => `${i.anio}-${i.mes}`))].sort(), [inds]);

  useEffect(() => {
    if (rangoManual) return;
    if (!ymsData.length) {
      const now = new Date();
      const end = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      setDesde(idxToYm(ymToIdx(end)-5)); setHasta(end);
    } else { setDesde(ymsData[0]); setHasta(ymsData[ymsData.length-1]); }
  }, [ymsData, rangoManual]);

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

  // Suma entre empresas del scope para un mes/clave.
  const valorSum = (ym, clave) => {
    let s = 0, hay = false;
    empresasActivas.forEach((en) => { const v = idx[`${en}|${ym}|${clave}`]; if (typeof v === 'number') { s += v; hay = true; } });
    return hay ? s : null;
  };
  // Nº de empresas del scope con dato ese mes.
  const valorCount = (ym, clave) => empresasActivas.reduce((n, en) => n + (typeof idx[`${en}|${ym}|${clave}`] === 'number' ? 1 : 0), 0);

  const serie = (clave) => meses.map((ym) => valorSum(ym, clave) ?? 0);

  // Agregaciones sobre una lista de meses.
  const sumRango = (lista, clave) => { let s=0,hay=false; lista.forEach((ym)=>{const v=valorSum(ym,clave); if(v!=null){s+=v;hay=true;}}); return hay?s:null; };
  const ultimo = (lista, clave) => { for(let k=lista.length-1;k>=0;k--){const v=valorSum(lista[k],clave); if(v!=null) return {v, ym:lista[k]};} return {v:null,ym:null}; };
  // Promedio mensual por empresa: por cada mes el promedio entre empresas, luego promedio en el tiempo.
  const promMensual = (lista, clave) => {
    const vals=[]; lista.forEach((ym)=>{ const s=valorSum(ym,clave), c=valorCount(ym,clave); if(s!=null&&c>0) vals.push(s/c); });
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  // Valor de una card según el modo (Totales / Promedio).
  const cardVal = (clave, lista) => {
    if (modoAgg === 'promedio') return { v: promMensual(lista, clave), ref: 'prom' };
    if (FLUJOS.includes(clave)) return { v: sumRango(lista, clave), ref: 'acum' };
    const u = ultimo(lista, clave); return { v: u.v, ref: u.ym };   // stocks y personal → último dato
  };

  const mesesComparacion = useMemo(() => {
    if (modo === 'mes') return meses.length ? [idxToYm(ymToIdx(meses[0]) - 1)] : [];
    if (modo === 'anio') return meses.map((ym) => idxToYm(ymToIdx(ym) - 12));
    return null;
  }, [modo, meses]);

  const kpis = useMemo(() => {
    if (!meses.length) return [];
    const calc = (lista) => { const g={}; CLAVES_CALC.forEach((c)=>{ g[c]=cardVal(c, lista); }); return g; };
    const cur = calc(meses);
    const prev = mesesComparacion ? calc(mesesComparacion) : null;
    const margen = (g) => (g && g.ingresos.v && g.costos.v!=null) ? (g.ingresos.v-g.costos.v)/g.ingresos.v*100 : null;
    const venc = (g) => (g && g.cartera_total.v) ? g.cartera_vencida.v/g.cartera_total.v*100 : null;

    const subTxt = (ref) => ref==='prom' ? 'Promedio mensual' : ref==='acum' ? 'Acumulado' : ref ? ymLabel(ref) : '';
    const fmtVal = (v, t) => v==null ? '—' : t==='pct' ? v.toFixed(1)+'%' : t==='num' ? fmt(v) : fmtM(v);
    const mk = (lbl, cv, pv, t, ref, goodUp) => {
      let delta=null, good='flat';
      if (pv!=null && cv!=null) {
        if (t==='pct') { const d=cv-pv; delta=(d>=0?'+':'')+d.toFixed(1)+' pts'; if(goodUp!=null) good=((d>0)===goodUp)?'pos':(d===0?'flat':'neg'); }
        else if (pv!==0) { const d=(cv-pv)/Math.abs(pv)*100; delta=(d>=0?'▲ ':'▼ ')+Math.abs(d).toFixed(1)+'%'; if(goodUp!=null) good=((d>0)===goodUp)?'pos':(d===0?'flat':'neg'); }
      }
      return { lbl, val: fmtVal(cv, t), sub: subTxt(ref), delta, good };
    };

    const cM = margen(cur), pM = prev?margen(prev):null;
    const cV = venc(cur), pV = prev?venc(prev):null;
    return [
      mk('Ingresos', cur.ingresos.v, prev?prev.ingresos.v:null, 'cop', cur.ingresos.ref, true),
      mk('Costos', cur.costos.v, prev?prev.costos.v:null, 'cop', cur.costos.ref, false),
      mk('Margen', cM, pM, 'pct', cur.ingresos.ref, true),
      mk('Cartera total', cur.cartera_total.v, prev?prev.cartera_total.v:null, 'cop', cur.cartera_total.ref, null),
      mk('Cartera vencida', cV, pV, 'pct', cur.cartera_total.ref, false),
      mk('Recaudo', cur.recaudo.v, prev?prev.recaudo.v:null, 'cop', cur.recaudo.ref, true),
      mk('Headcount', cur.headcount.v, prev?prev.headcount.v:null, 'num', cur.headcount.ref, true),
      mk('Entradas', cur.entradas.v, prev?prev.entradas.v:null, 'num', cur.entradas.ref, true),
      mk('Salidas', cur.salidas.v, prev?prev.salidas.v:null, 'num', cur.salidas.ref, false),
    ];
  }, [idx, meses, mesesComparacion, empresaSel, empresas, modoAgg]);

  const compLabel = modo==='anio' ? 'vs año anterior' : modo==='mes' ? 'vs mes anterior' : '';

  const comparacion = useMemo(() => {
    if (!meses.length) return [];
    return empresas.map((e) => {
      let s=0,hay=false; meses.forEach((ym)=>{const v=idx[`${e.nombre}|${ym}|ingresos`]; if(typeof v==='number'){s+=v;hay=true;}});
      return { nombre: e.nombre, ing: hay?s:0 };
    }).filter((r)=>r.ing>0).sort((a,b)=>b.ing-a.ing);
  }, [idx, meses, empresas]);

  const porConfirmar = useMemo(() =>
    inds.filter((i) => i.estado === 'por_confirmar' && (empresaSel==='ALL' || i.empresa===empresaSel))
        .sort((a,b)=> (a.empresa+a.anio+a.mes).localeCompare(b.empresa+b.anio+b.mes)),
  [inds, empresaSel]);

  const extraerTodos = async () => {
    if (extrayendoTodos) return;
    if (!confirm('Se intentará extraer indicadores de TODOS los archivos con IA. Puede tardar varios minutos y no debes cerrar esta pestaña. ¿Continuar?')) return;
    setExtrayendoTodos(true); setProgreso('Cargando lista de archivos...');
    try {
      const archivos = await getAllArchivos();
      let hecho=0, con=0, fallos=0; const CONC=4;
      for (let i=0;i<archivos.length;i+=CONC) {
        await Promise.all(archivos.slice(i,i+CONC).map(async (a)=>{
          try { const r=await extraer(a.id); if((r?.creados||0)+(r?.actualizados||0)>0) con+=1; }
          catch(e){ fallos+=1; console.error('extraer',a.nombre,e); } finally { hecho+=1; }
        }));
        setProgreso(`Procesando ${hecho}/${archivos.length} archivos · ${con} con indicadores${fallos?` · ${fallos} fallidos`:''}`);
      }
      setProgreso(`Listo: ${archivos.length} archivos procesados, ${con} aportaron indicadores. Revisa "Por confirmar".`);
      cargar();
    } catch(e){ console.error(e); setProgreso(`Error: ${e.message||e}`); }
    finally { setExtrayendoTodos(false); }
  };

  const onConfirmarTodos = async () => {
    if (confirmandoTodos || !porConfirmar.length) return;
    if (!confirm(`¿Confirmar ${porConfirmar.length} indicador(es)?`)) return;
    setConfirmandoTodos(true);
    try { const items=porConfirmar.slice(); const CONC=8;
      for (let i=0;i<items.length;i+=CONC) await Promise.all(items.slice(i,i+CONC).map((it)=>confirmarIndicador(it.id).catch((e)=>console.error(e))));
      cargar();
    } finally { setConfirmandoTodos(false); }
  };
  const onConfirmar = async (i) => { try { await confirmarIndicador(i.id); cargar(); } catch(e){ alert(e.message); } };
  const onGuardarEdit = async (i) => { try { await editarValor(i.id, editVal); setEditId(null); cargar(); } catch(e){ alert(e.message); } };
  const onEliminar = async (i) => { if(!confirm('¿Descartar este indicador?'))return; await eliminarIndicador(i.id); cargar(); };

  const ultimoYm = () => ymsData[ymsData.length-1] || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const aplicarPreset = (p) => {
    const last = ultimoYm(); setRangoManual(true);
    if (p === 'mes') { setDesde(last); setHasta(last); setModo('mes'); }
    else if (p === 'anio') { setDesde(`${last.split('-')[0]}-01`); setHasta(last); setModo('anio'); }
  };
  const cambiarMesManual = (setter) => (e) => { setter(e.target.value); setModo('rango'); setRangoManual(true); };

  // ---- Datos de las gráficas ----
  const ing = serie('ingresos'), cost = serie('costos');
  const hayFinanciero = ing.some(v=>v>0) || cost.some(v=>v>0);
  const headSerie = serie('headcount'), entSerie = serie('entradas'), salSerie = serie('salidas');
  const hayPersonal = headSerie.some(v=>v>0) || entSerie.some(v=>v>0) || salSerie.some(v=>v>0);

  const W=560,H=220,pl=52,pr=14,pt=12,pb=26,iw=W-pl-pr,ih=H-pt-pb;
  const px=(i,n)=> (n<2 ? pl+iw/2 : pl + i/(n-1)*iw);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
            <button onClick={()=>aplicarPreset('anio')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo==='anio'?'bg-[#0A353F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Este año</button>
            <button onClick={()=>aplicarPreset('mes')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo==='mes'?'bg-[#0A353F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Último mes</button>
          </div>
          <input type="month" value={desde} onChange={cambiarMesManual(setDesde)} className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="month" value={hasta} onChange={cambiarMesManual(setHasta)} className="bg-[#F5F5F7] rounded-xl px-3 py-2 text-sm font-medium text-[#0A353F] outline-none" />
          <button onClick={extraerTodos} disabled={extrayendoTodos} title="Extraer indicadores de todos los archivos"
            className="flex items-center gap-2 bg-[#8CC63F] text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[#7ab234] transition-colors disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {extrayendoTodos ? 'Extrayendo...' : 'Extraer de todos'}
          </button>
          <button onClick={cargar} title="Recargar" className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {progreso && (
        <div className="mb-5 bg-[#0A353F] text-white text-sm px-4 py-3 rounded-xl flex items-center gap-3">
          {extrayendoTodos && <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />}
          <span className="flex-1">{progreso}</span>
          {!extrayendoTodos && <button onClick={() => setProgreso('')} className="text-white/60 hover:text-white">×</button>}
        </div>
      )}

      {/* Switch Totales / Promedio */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center bg-[#F5F5F7] rounded-xl p-0.5">
          <button onClick={()=>setModoAgg('total')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modoAgg==='total'?'bg-[#8CC63F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Totales</button>
          <button onClick={()=>setModoAgg('promedio')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modoAgg==='promedio'?'bg-[#8CC63F] text-white':'text-gray-500 hover:text-[#0A353F]'}`}>Promedio</button>
        </div>
        <span className="text-xs text-gray-400">
          {modoAgg==='total'
            ? 'Ingresos, costos y recaudo acumulados; cartera y personal = último dato disponible (mes indicado en cada card).'
            : 'Promedio mensual por empresa en el rango.'}
        </span>
      </div>

      {/* KPIs (9) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {kpis.map((k)=>(
          <div key={k.lbl} className="bg-[#F5F5F7] rounded-2xl p-4">
            <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold truncate">{k.lbl}</p>
            <p className="text-lg font-bold text-[#0A353F] mt-1">{k.val}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight min-h-[24px]">
              {k.sub}
              {k.delta && <span className={`block font-semibold ${k.good==='pos'?'text-green-600':k.good==='neg'?'text-red-500':'text-gray-400'}`}>{k.delta} {compLabel}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Ingresos vs Costos */}
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
        ) : (() => {
          const n=meses.length, max=Math.max(1,...ing,...cost), y=(v)=>pt+ih-(v/max)*ih;
          const path=(arr)=>arr.map((v,i)=>`${i?'L':'M'}${px(i,n).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              {[0,0.25,0.5,0.75,1].map((t)=>(<g key={t}><line x1={pl} y1={y(max*t)} x2={W-pr} y2={y(max*t)} stroke="#EEF3F1" /><text x={pl-8} y={y(max*t)+3} textAnchor="end" fontSize="10" fill="#7B8D89" fontFamily="monospace">{fmt(max*t/1e6)}M</text></g>))}
              {meses.map((ym,i)=><text key={ym} x={px(i,n)} y={H-8} textAnchor="middle" fontSize="10" fill="#7B8D89">{MES[(+ym.split('-')[1])-1]}</text>)}
              <path d={path(cost)} fill="none" stroke="#C4703C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <path d={path(ing)} fill="none" stroke="#0097A7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {meses.map((ym,i)=>(<g key={'p'+i}>
                <circle cx={px(i,n)} cy={y(cost[i])} r={tip&&tip.i===i?3.5:2.5} fill="#C4703C" />
                <circle cx={px(i,n)} cy={y(ing[i])} r={tip&&tip.i===i?3.5:2.5} fill="#0097A7" />
                <rect x={px(i,n)-(iw/Math.max(n,1)/2)} y={pt} width={iw/Math.max(n,1)} height={ih} fill="transparent"
                  onMouseMove={(e)=>setTip({x:e.clientX,y:e.clientY,i,ym,ing:ing[i],cost:cost[i]})} onMouseLeave={()=>setTip(null)} />
              </g>))}
            </svg>
          );
        })()}
      </div>

      {tip && (
        <div style={{position:'fixed',left:tip.x+14,top:tip.y+14,zIndex:50,pointerEvents:'none'}} className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
          <p className="font-semibold text-gray-600 mb-1">{ymLabel(tip.ym)}</p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#0097A7'}} />Ingresos</span><b className="font-mono">{fmtM(tip.ing)}</b></p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#C4703C'}} />Costos</span><b className="font-mono">{fmtM(tip.cost)}</b></p>
        </div>
      )}

      {/* Personal: Headcount (línea) + Entradas/Salidas (barras divergentes) en un solo gráfico */}
      {hayPersonal && (
        <div className="border border-gray-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2"><Users className="w-4 h-4 text-[#8CC63F]" /> Personal en el tiempo</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 rounded-sm inline-block" style={{background:'#6D5FB8'}} />Headcount</span>
              <span className={`flex items-center gap-1.5 ${mostrarFlujos?'':'opacity-40'}`}><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#16A34A'}} />Entradas</span>
              <span className={`flex items-center gap-1.5 ${mostrarFlujos?'':'opacity-40'}`}><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#DC2626'}} />Salidas</span>
              <button onClick={()=>setMostrarFlujos(v=>!v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${mostrarFlujos?'bg-[#0A353F] text-white':'bg-[#F5F5F7] text-gray-500 hover:text-[#0A353F]'}`}>
                {mostrarFlujos ? 'Ocultar entradas/salidas' : 'Mostrar entradas/salidas'}
              </button>
            </div>
          </div>
          {(() => {
            const n=meses.length;
            // Entradas/Salidas: escala compartida; las barras nacen del punto de headcount.
            const maxF=Math.max(1,...entSerie,...salSerie);
            const gw=iw/Math.max(n,1), bw=Math.min(14, gw*0.5);
            const band=ih*0.20;                     // alto máximo de una barra (px)
            const hF=(v)=>(v/maxF)*band;
            // Headcount: la línea va por el centro, dejando margen arriba/abajo para las barras.
            const hcMax=Math.max(1,...headSerie), hcMinRaw=Math.min(...headSerie.filter(v=>v>0), hcMax);
            const hcMin=Math.max(0, Math.floor(hcMinRaw*0.97));
            const top=pt+band+12, bot=pt+ih-band-12;
            const yH=(v)=> bot-((v-hcMin)/Math.max(1,hcMax-hcMin))*(bot-top);
            const pathH=headSerie.map((v,i)=>`${i?'L':'M'}${px(i,n).toFixed(1)} ${yH(v).toFixed(1)}`).join(' ');
            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                {/* eje headcount (izq, morado) */}
                {[hcMin, hcMin+(hcMax-hcMin)/2, hcMax].map((v,k)=>(<g key={'h'+k}>
                  <line x1={pl} y1={yH(v)} x2={W-pr} y2={yH(v)} stroke="#F3F1FB" />
                  <text x={pl-8} y={yH(v)+3} textAnchor="end" fontSize="10" fill="#6D5FB8" fontFamily="monospace">{fmt(v)}</text>
                </g>))}
                {/* barras divergentes ancladas al headcount: entradas arriba, salidas abajo */}
                {mostrarFlujos && meses.map((ym,i)=>{ const cx=px(i,n), yc=yH(headSerie[i]); return (<g key={'f'+ym}>
                  <rect x={cx-bw/2} y={yc-hF(entSerie[i])} width={bw} height={hF(entSerie[i])} rx="2" fill="#16A34A" opacity="0.9" />
                  <rect x={cx-bw/2} y={yc} width={bw} height={hF(salSerie[i])} rx="2" fill="#DC2626" opacity="0.9" />
                </g>); })}
                {/* línea headcount (el resultado, en el centro de las barras) */}
                <path d={pathH} fill="none" stroke="#6D5FB8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {headSerie.map((v,i)=><circle key={'c'+i} cx={px(i,n)} cy={yH(v)} r={tipP&&tipP.i===i?4:2.5} fill="#6D5FB8" stroke="#fff" strokeWidth="1" />)}
                {/* etiquetas de mes + zonas de hover */}
                {meses.map((ym,i)=>(<g key={'x'+ym}>
                  <text x={px(i,n)} y={H-8} textAnchor="middle" fontSize="10" fill="#7B8D89">{MES[(+ym.split('-')[1])-1]}</text>
                  <rect x={px(i,n)-gw/2} y={pt} width={gw} height={ih} fill="transparent"
                    onMouseMove={(e)=>setTipP({x:e.clientX,y:e.clientY,i,ym,head:headSerie[i],ent:entSerie[i],sal:salSerie[i]})}
                    onMouseLeave={()=>setTipP(null)} />
                </g>))}
              </svg>
            );
          })()}
        </div>
      )}

      {tipP && (
        <div style={{position:'fixed',left:tipP.x+14,top:tipP.y+14,zIndex:50,pointerEvents:'none'}} className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
          <p className="font-semibold text-gray-600 mb-1">{ymLabel(tipP.ym)}</p>
          <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#6D5FB8'}} />Headcount</span><b className="font-mono">{fmt(tipP.head)}</b></p>
          {mostrarFlujos && <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#16A34A'}} />Entradas</span><b className="font-mono">{fmt(tipP.ent)}</b></p>}
          {mostrarFlujos && <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm inline-block" style={{background:'#DC2626'}} />Salidas</span><b className="font-mono">{fmt(tipP.sal)}</b></p>}
        </div>
      )}

      {/* Ingresos por empresa (consolidado) */}
      {empresaSel==='ALL' && comparacion.length>0 && (
        <div className="border border-gray-100 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">Ingresos por empresa <span className="font-normal text-gray-400">· acumulado del rango</span></h3>
          <div className="flex flex-col gap-2.5">
            {comparacion.map((r)=>{ const max=comparacion[0].ing||1; return (
              <button key={r.nombre} onClick={()=>setEmpresaSel(r.nombre)} className="grid items-center gap-3 text-left group" style={{gridTemplateColumns:'130px 1fr auto'}}>
                <span className="text-xs font-semibold text-gray-600 truncate group-hover:text-[#0097A7]">{r.nombre}</span>
                <span className="bg-[#EEF3F1] rounded-md h-3.5 overflow-hidden"><span className="block h-full rounded-md" style={{width:`${(r.ing/max*100).toFixed(1)}%`,background:'#0097A7'}} /></span>
                <span className="font-mono text-xs font-semibold text-[#1d1d1f]">{fmtM(r.ing)}</span>
              </button>
            ); })}
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
            <button onClick={onConfirmarTodos} disabled={confirmandoTodos} className="flex items-center gap-2 bg-[#0A353F] text-white rounded-xl px-3 py-2 text-xs font-semibold hover:bg-[#0A353F]/90 transition-colors disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {confirmandoTodos ? 'Confirmando...' : `Confirmar todos (${porConfirmar.length})`}
            </button>
          )}
        </div>
        {cargando ? (
          <p className="text-gray-400 text-sm">Cargando…</p>
        ) : porConfirmar.length===0 ? (
          <p className="text-gray-400 text-sm">Nada por confirmar.</p>
        ) : (
          <div className="space-y-2">
            {porConfirmar.map((i)=>(
              <div key={i.id} className="flex items-center gap-3 bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#0A353F]">{i.empresa}</span>
                  <span className="text-xs text-gray-400"> · {ymLabel(`${i.anio}-${i.mes}`)} · {CLAVE_LBL[i.clave]||i.clave}</span>
                </div>
                {editId===i.id ? (
                  <input autoFocus value={editVal} onChange={(e)=>setEditVal(e.target.value)} className="w-32 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono" />
                ) : (
                  <span className="font-mono text-sm text-[#1d1d1f]" title={i.unidad==='%'?'':'$'+fmt(i.valor)}>{i.unidad==='%'?(i.valor+'%'):i.unidad==='num'?fmt(i.valor):fmtM(i.valor)}</span>
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
