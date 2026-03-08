import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';

const idSchema = z.string().trim().min(1);

const chatIdParamsSchema = z.object({
    chatId: idSchema
}).strict();

const chatMessageParamsSchema = z.object({
    chatId: idSchema,
    messageId: idSchema
}).strict();

const getChatMessagesQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
}).strict();

const sendMessageSchema = z.object({
    content: z.string().trim().min(1),
    messageType: z.enum(['text', 'file', 'system'])
}).strict();

const editMessageSchema = z.object({
    content: z.string().trim().min(1)
}).strict();

const toggleReactionSchema = z.object({
    emoji: z.string().trim().min(1)
}).strict();

export const chatMessageValidation = {
    getChatMessages: createValidationMiddleware({
        params: chatIdParamsSchema,
        query: getChatMessagesQuerySchema
    }),
    sendMessage: createValidationMiddleware({
        params: chatIdParamsSchema,
        body: sendMessageSchema
    }),
    editMessage: createValidationMiddleware({
        params: chatMessageParamsSchema,
        body: editMessageSchema
    }),
    deleteMessage: createValidationMiddleware(chatMessageParamsSchema, 'params'),
    markMessagesAsRead: createValidationMiddleware(chatIdParamsSchema, 'params'),
    toggleReaction: createValidationMiddleware({
        params: chatMessageParamsSchema,
        body: toggleReactionSchema
    }),
    sendFileMessage: createValidationMiddleware(chatIdParamsSchema, 'params')
};
