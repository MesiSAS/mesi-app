import { generateClient } from 'aws-amplify/data';

const client = generateClient();

const USUARIOS_INICIALES = [
  {
    empresa: '4G Architecture',
    correo: 'dibarra@4garchitecture.com.co',
    nombre: 'Daniel Ibarra',
    tipo: 'user',
    password: '4G@2025',
    logo: '/logos/4g-architecture.png',
  },
  {
    empresa: '4G Energía',
    correo: 'adelaespriella@4genergia.com.co',
    nombre: 'Alcides De la Espriella',
    tipo: 'user',
    password: '4GE@2025',
    logo: '/logos/4g-energia.png',
  },
  {
    empresa: 'Ombia',
    correo: 'hceledon@ombia.co',
    nombre: 'Hernando Celedon',
    tipo: 'user',
    password: 'Ombia@2025',
    logo: '/logos/ombia.png',
  },
  {
    empresa: 'Mesi',
    correo: 'jorgeisaac@mesi.com.co',
    nombre: 'Jorge Isaac',
    tipo: 'admin',
    password: 'Mesi@2025',
    logo: '/logos/mesi.png',
  },
  {
    empresa: 'Mesi',
    correo: 'gacosta@mesi.com.co',
    nombre: 'Gustavo Acosta',
    tipo: 'admin',
    password: 'Mesi@2025',
    logo: '/logos/mesi.png',
  },
  {
    empresa: 'Mesi',
    correo: 'cechandia@4garchitecture.com.co',
    nombre: 'Camilo Echandia',
    tipo: 'admin',
    password: 'Mesi@2025',
    logo: '/logos/mesi.png',
  },
];

const MODULOS_INICIALES = [
  {
    nombre: 'Contabilidad',
    icono: 'FileText',
    logo: '',
    submodulos: [],
  },
  {
    nombre: 'Finanzas',
    icono: 'TrendingUp',
    logo: '',
    submodulos: [],
  },
  {
    nombre: 'Talento Humano',
    icono: 'Users',
    logo: '',
    submodulos: [],
  },
  {
    nombre: 'Compras',
    icono: 'ShoppingBag',
    logo: '',
    submodulos: [],
  },
  {
    nombre: 'Tecnología',
    icono: 'Cpu',
    logo: '',
    submodulos: [],
  },
];

export async function seedData() {

  try {

    console.log('Cargando usuarios...');

    for (const usuario of USUARIOS_INICIALES) {

      await client.models.Usuario.create(usuario);

      console.log('Usuario creado:', usuario.nombre);
    }

    console.log('Cargando módulos...');

    for (const modulo of MODULOS_INICIALES) {

      await client.models.Modulo.create(modulo);

      console.log('Módulo creado:', modulo.nombre);
    }

    console.log('SEED COMPLETADO');

  } catch (error) {

    console.error(error);
  }
}