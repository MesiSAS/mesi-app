import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

import { auth } from './auth/resource';
import {
  chatAssistant,
  data,
  BEDROCK_CHAT_MODEL_ID,
  BEDROCK_EMBEDDING_MODEL_ID,
} from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  chatAssistant,
  storage,
});

// El modelo de chat puede invocarse via inference profile cross-region (prefijo `us.`),
// por lo que la policy debe permitir tanto el inference-profile como los foundation-model
// subyacentes en cada region que abarca el perfil (us-east-1, us-east-2, us-west-2).
const isInferenceProfile = BEDROCK_CHAT_MODEL_ID.startsWith('us.');
const chatFoundationModel = isInferenceProfile
  ? BEDROCK_CHAT_MODEL_ID.slice('us.'.length)
  : BEDROCK_CHAT_MODEL_ID;
const inferenceRegions = ['us-east-1', 'us-east-2', 'us-west-2'];

const chatModelResources = isInferenceProfile
  ? [
      `arn:aws:bedrock:${backend.stack.region}:${backend.stack.account}:inference-profile/${BEDROCK_CHAT_MODEL_ID}`,
      ...inferenceRegions.map(
        (region) => `arn:aws:bedrock:${region}::foundation-model/${chatFoundationModel}`
      ),
    ]
  : [`arn:aws:bedrock:${backend.stack.region}::foundation-model/${chatFoundationModel}`];

backend.chatAssistant.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      ...chatModelResources,
      `arn:aws:bedrock:${backend.stack.region}::foundation-model/${BEDROCK_EMBEDDING_MODEL_ID}`,
    ],
  })
);
