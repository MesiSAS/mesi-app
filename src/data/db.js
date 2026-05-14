const USERS_KEY = 'mesi_users';
const EMPRESAS_KEY = 'mesi_empresas';
const MODULOS_KEY = 'mesi_modulos';
const EMPRESA_MODULOS_KEY = 'mesi_empresa_modulos';

const USUARIOS_INICIALES = [
  { id: '1', empresa: '4G Architecture', correo: 'dibarra@4garchitecture.com.co', nombre: 'Daniel Ibarra', tipo: 'user', password: '4G@2025', logo: '/logos/4g-architecture.png' },
  { id: '2', empresa: '4G Energía', correo: 'adelaespriella@4genergia.com.co', nombre: 'Alcides De la Espriella', tipo: 'user', password: '4GE@2025', logo: '/logos/4g-energia.png' },
  { id: '3', empresa: 'Ombia', correo: 'hceledon@ombia.co', nombre: 'Hernando Celedon', tipo: 'user', password: 'Ombia@2025', logo: '/logos/ombia.png' },
  { id: '4', empresa: 'Mesi', correo: 'jorgeisaac@mesi.com.co', nombre: 'Jorge Isaac', tipo: 'admin', password: 'Mesi@2025', logo: '/logos/mesi.png' },
  { id: '5', empresa: 'Mesi', correo: 'gacosta@mesi.com.co', nombre: 'Gustavo Acosta', tipo: 'admin', password: 'Mesi@2025', logo: '/logos/mesi.png' },
  { id: '6', empresa: 'Mesi', correo: 'cechandia@4garchitecture.com.co', nombre: 'Camilo Echandia', tipo: 'admin', password: 'Mesi@2025', logo: '/logos/mesi.png' },
];

const EMPRESAS_INICIALES = [
  { id: '1', nombre: '4G Architecture', logo: '/logos/4g-architecture.png' },
  { id: '2', nombre: '4G Energía', logo: '/logos/4g-energia.png' },
  { id: '3', nombre: 'Ombia', logo: '/logos/ombia.png' },
];

const MODULOS_INICIALES = [
  { id: '1', nombre: 'Contabilidad', icono: 'FileText', logo: '', submodulos: [] },
  { id: '2', nombre: 'Finanzas', icono: 'TrendingUp', logo: '', submodulos: [] },
  { id: '3', nombre: 'Talento Humano', icono: 'Users', logo: '', submodulos: [] },
  { id: '4', nombre: 'Compras', icono: 'ShoppingBag', logo: '', submodulos: [] },
  { id: '5', nombre: 'Tecnología', icono: 'Cpu', logo: '', submodulos: [] },
];

// empresa_modulos: { empresaNombre: { moduloId: true/false } }
const EMPRESA_MODULOS_INICIAL = {
  '4G Architecture': { '1': true, '2': true, '3': true, '4': true, '5': true },
  '4G Energía':      { '1': true, '2': true, '3': true, '4': true, '5': true },
  'Ombia':           { '1': true, '2': true, '3': true, '4': true, '5': true },
};

export const initDB = () => {
  if (!localStorage.getItem(USERS_KEY)) localStorage.setItem(USERS_KEY, JSON.stringify(USUARIOS_INICIALES));
  if (!localStorage.getItem(EMPRESAS_KEY)) localStorage.setItem(EMPRESAS_KEY, JSON.stringify(EMPRESAS_INICIALES));
  if (!localStorage.getItem(MODULOS_KEY)) localStorage.setItem(MODULOS_KEY, JSON.stringify(MODULOS_INICIALES));
  if (!localStorage.getItem(EMPRESA_MODULOS_KEY)) localStorage.setItem(EMPRESA_MODULOS_KEY, JSON.stringify(EMPRESA_MODULOS_INICIAL));
};

// ── Usuarios ─────────────────────────────────────────────────
export const getUsuarios = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
export const saveUsuarios = (list) => localStorage.setItem(USERS_KEY, JSON.stringify(list));
export const findUser = (correo, password) => getUsuarios().find(u => u.correo === correo && u.password === password) || null;
export const createUsuario = (data) => {
  const list = getUsuarios();
  const empresa = getEmpresas().find(e => e.nombre === data.empresa);
  const nuevo = { ...data, id: Date.now().toString(), logo: empresa?.logo || '' };
  saveUsuarios([...list, nuevo]);
  return nuevo;
};
export const updateUsuario = (id, data) => {
  const list = getUsuarios().map(u => {
    if (u.id !== id) return u;
    const empresa = getEmpresas().find(e => e.nombre === data.empresa);
    return { ...u, ...data, logo: empresa?.logo || u.logo };
  });
  saveUsuarios(list);
};
export const deleteUsuario = (id) => saveUsuarios(getUsuarios().filter(u => u.id !== id));

// ── Empresas ─────────────────────────────────────────────────
export const getEmpresas = () => JSON.parse(localStorage.getItem(EMPRESAS_KEY) || '[]');
export const saveEmpresas = (list) => localStorage.setItem(EMPRESAS_KEY, JSON.stringify(list));
export const createEmpresa = (data) => {
  const list = getEmpresas();
  const nueva = { ...data, id: Date.now().toString() };
  saveEmpresas([...list, nueva]);
  // Activar todos los módulos para la nueva empresa
  const em = getEmpresaModulos();
  em[data.nombre] = {};
  getModulos().forEach(m => { em[data.nombre][m.id] = true; });
  saveEmpresaModulos(em);
  return nueva;
};
export const updateEmpresa = (id, data) => saveEmpresas(getEmpresas().map(e => e.id === id ? { ...e, ...data } : e));
export const deleteEmpresa = (id) => saveEmpresas(getEmpresas().filter(e => e.id !== id));

// ── Módulos ──────────────────────────────────────────────────
export const getModulos = () => JSON.parse(localStorage.getItem(MODULOS_KEY) || '[]');
export const saveModulos = (list) => localStorage.setItem(MODULOS_KEY, JSON.stringify(list));
export const createModulo = (data) => {
  const list = getModulos();
  const nuevo = { ...data, id: Date.now().toString(), submodulos: data.submodulos || [] };
  saveModulos([...list, nuevo]);
  // Activarlo en todas las empresas por defecto
  const em = getEmpresaModulos();
  getEmpresas().forEach(e => {
    if (!em[e.nombre]) em[e.nombre] = {};
    em[e.nombre][nuevo.id] = true;
  });
  saveEmpresaModulos(em);
  return nuevo;
};
export const updateModulo = (id, data) => saveModulos(getModulos().map(m => m.id === id ? { ...m, ...data } : m));
export const deleteModulo = (id) => saveModulos(getModulos().filter(m => m.id !== id));

// ── Submódulos ───────────────────────────────────────────────
export const addSubmodulo = (moduloId, nombre) => {
  const list = getModulos().map(m => {
    if (m.id !== moduloId) return m;
    const subs = m.submodulos || [];
    return { ...m, submodulos: [...subs, { id: Date.now().toString(), nombre }] };
  });
  saveModulos(list);
};
export const deleteSubmodulo = (moduloId, subId) => {
  const list = getModulos().map(m => {
    if (m.id !== moduloId) return m;
    return { ...m, submodulos: (m.submodulos || []).filter(s => s.id !== subId) };
  });
  saveModulos(list);
};

// ── Empresa-Módulos (activación) ─────────────────────────────
export const getEmpresaModulos = () => JSON.parse(localStorage.getItem(EMPRESA_MODULOS_KEY) || '{}');
export const saveEmpresaModulos = (data) => localStorage.setItem(EMPRESA_MODULOS_KEY, JSON.stringify(data));
export const toggleModuloEmpresa = (empresaNombre, moduloId, activo) => {
  const em = getEmpresaModulos();
  if (!em[empresaNombre]) em[empresaNombre] = {};
  em[empresaNombre][moduloId] = activo;
  saveEmpresaModulos(em);
};
export const getModulosActivos = (empresaNombre) => {
  const em = getEmpresaModulos();
  const config = em[empresaNombre] || {};
  return getModulos().filter(m => config[m.id] !== false);
};