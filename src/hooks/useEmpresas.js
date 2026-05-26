import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';

const getClient = () => generateClient();


export const useEmpresas = () => {
  const client = generateClient({
    config: outputs,
    });    
  const getEmpresas = async () => {
        try {

            const response = await client.models.Empresa.list();

            return response.data || [];

        } catch (error) {

            console.error(error);

            return [];
        }
    };

  const createEmpresa = async (data) => {

    const response = await client.models.Empresa.create({
      nombre: data.nombre,
      logo: data.logo || '',
    });

    return response.data;
  };

  const updateEmpresa = async (id, data) => {

    await client.models.Empresa.update({
      id,
      nombre: data.nombre,
      logo: data.logo || '',
    });
  };

  const deleteEmpresa = async (id) => {

    await client.models.Empresa.delete({
      id,
    });
  };

  return {
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
  };
};