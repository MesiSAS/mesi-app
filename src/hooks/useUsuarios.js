import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export function useUsuarios() {

  const getUsuarios = async () => {
    const response = await client.models.Usuario.list();

    return response.data || [];
  };

  const createUsuario = async (usuario) => {
    await client.models.Usuario.create(usuario);
  };

  const updateUsuario = async (id, data) => {
    await client.models.Usuario.update({
      id,
      ...data,
    });
  };

  const deleteUsuario = async (id) => {
    await client.models.Usuario.delete({ id });
  };

  return {
    getUsuarios,
    createUsuario,
    updateUsuario,
    deleteUsuario,
  };
}