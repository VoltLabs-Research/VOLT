import { z } from 'zod/v4';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { aiConversationMessagesSchema } from './ai-message-schemas';
import { AIProvider } from '@modules/ai/domain/contracts/AIProviders';

const createConversationSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).optional()
}).strict();

const streamMessageSchema = z.object({
    messages: aiConversationMessagesSchema,
    provider: z.enum(AIProvider).optional(),
    model: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200).optional()
}).superRefine((value, context) => {
    const lastUserMessage = [...value.messages]
        .reverse()
        .find((message) => message.role === AIConversationMessageRole.User);

    if (!lastUserMessage) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'a user text message is required',
            path: ['messages']
        });
        return;
    }

    const textContent = lastUserMessage.parts
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => String(part.text).trim())
        .join('\n')
        .trim();

    if (!textContent) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'a user text message is required',
            path: ['messages']
        });
    }
});

const updateConversationSchema = z.object({
    title: z.string().min(1).max(200),
    isArchived: z.boolean()
}).strict().partial();

export const aiConversationValidation = createResourceValidation({
    createConversation: createConversationSchema,
    sendStreamMessage: streamMessageSchema,
    updateConversation: updateConversationSchema
});
