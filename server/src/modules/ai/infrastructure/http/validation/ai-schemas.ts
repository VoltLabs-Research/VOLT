import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { AI_PROVIDERS } from '@modules/ai/domain/constants/AIProviders';
import { aiConversationMessagesSchema } from './ai-message-schemas';

const createConversationSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).optional()
}).strict();

const sendMessageSchema = z.object({
    message: z.string().trim().min(1).optional(),
    messages: aiConversationMessagesSchema.optional(),
    provider: z.enum(AI_PROVIDERS).optional(),
    model: z.string().trim().min(1).optional()
}).strict();

const streamMessageSchema = z.object({
    messages: aiConversationMessagesSchema,
    provider: z.enum(AI_PROVIDERS).optional(),
    model: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200).optional()
}).strict().superRefine((value, context) => {
    const lastUserMessage = [...value.messages]
        .reverse()
        .find((message) => message.role === 'user');

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

export const aiConversationValidation = {
    createConversation: createValidationMiddleware(createConversationSchema),
    sendMessage: createValidationMiddleware(sendMessageSchema),
    sendStreamMessage: createValidationMiddleware(streamMessageSchema),
    updateConversation: createValidationMiddleware(updateConversationSchema)
};
