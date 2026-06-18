import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export const useAiAssistant = () => {
  const askAssistant = async ({ userId, message, empresa, modulo, moduloActivo }) => {
    const response = await client.mutations.chatAssistant({
      userId,
      message,
      empresa,
      modulo,
      moduloActivo,
    });

    if (response.errors?.length) {
      throw new Error(response.errors.map(error => error.message).join('\n'));
    }

    return response.data;
  };

  // Carga el historial persistido del usuario (memoria entre sesiones).
  const getHistorial = async (userId) => {
    const response = await client.models.ChatMessage.list({
      filter: { userId: { eq: userId } },
      limit: 200,
    });

    const safeParse = (value) => {
      try { return value ? JSON.parse(value) : []; } catch { return []; }
    };

    return (response.data || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((m) => ({
        role: m.role,
        content: m.content,
        sources: safeParse(m.sources),
      }));
  };

  return {
    askAssistant,
    getHistorial,
  };
};
