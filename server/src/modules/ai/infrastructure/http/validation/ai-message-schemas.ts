import { z } from 'zod/v4';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';

export const aiMessagePartSchema = z.object({
    type: z.string().min(1)
}).passthrough();

export const aiConversationMessageSchema = z.object({
    id: z.string().min(1),
    role: z.enum(AIConversationMessageRole),
    parts: z.array(aiMessagePartSchema).min(1)
});

export const aiConversationMessagesSchema = z.array(aiConversationMessageSchema).min(1);
