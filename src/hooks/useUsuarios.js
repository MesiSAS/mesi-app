import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export function useUsuarios() {

  const getUsuarios = async () => {
    const response = await client.models.Usuario.list();

    // Si la API falla (p. ej. API key expirada) viene en errors con data vacia.
    // Lanzamos para que el login muestre "no se pudo conectar" y no un falso
    // "contrasena incorrecta".
    if (response.errors?.length) {
      throw new Error(response.errors.map((e) => e.message).join('; '));
    }

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