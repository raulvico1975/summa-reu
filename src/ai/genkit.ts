import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {buildSharedAiRuntimeConfig} from '@/ai/config';

const sharedAiRuntimeConfig = buildSharedAiRuntimeConfig();

export const ai = genkit({
  plugins: [googleAI({
    apiKey: sharedAiRuntimeConfig.apiKey,
  })],
  model: sharedAiRuntimeConfig.model,
});
