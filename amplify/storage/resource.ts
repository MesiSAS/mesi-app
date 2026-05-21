import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'mesiStorage',
  access: (allow) => ({
    'archivos/*': [
      allow.guest.to(['read', 'write', 'delete']),
    ],
  }),
});