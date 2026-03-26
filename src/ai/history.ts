import { MessageSchema, type MessageData } from 'genkit';

const MessageHistorySchema = MessageSchema.array();

export type AiHistoryResponseLike = {
  messages: MessageData[];
};

function cloneAiHistoryMessages(messages: MessageData[]): MessageData[] {
  return MessageHistorySchema.parse(JSON.parse(JSON.stringify(messages)));
}

/**
 * Future multi-turn Gemini flows must persist the full `response.messages`
 * payload unchanged so thought signatures remain attached to the original part.
 */
export function extractSerializableAiResponseMessages(
  response: AiHistoryResponseLike
): MessageData[] {
  return cloneAiHistoryMessages(response.messages);
}

export function serializeAiResponseMessages(response: AiHistoryResponseLike): string {
  return JSON.stringify(extractSerializableAiResponseMessages(response));
}

export function parseSerializedAiHistoryMessages(serialized: string): MessageData[] {
  return MessageHistorySchema.parse(JSON.parse(serialized));
}
