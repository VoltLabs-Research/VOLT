import { z } from 'zod/v4';

export const aiMessagePartSchema = z.object({
    type: z.string().min(1)
}).passthrough();

export const aiConversationMessageSchema = z.object({
    id: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system']),
    parts: z.array(aiMessagePartSchema).min(1)
}).strict();

export const aiConversationMessagesSchema = z.array(aiConversationMessageSchema).min(1);
