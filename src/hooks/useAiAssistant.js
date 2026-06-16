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

  return {
    askAssistant,
  };
};
