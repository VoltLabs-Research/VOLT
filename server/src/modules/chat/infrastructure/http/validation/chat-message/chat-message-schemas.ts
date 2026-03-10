import { ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { requiredTextSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { z } from 'zod/v4';

const chatIdParamsSchema = z.object({
    chatId: requiredTextSchema
}).strict();

const chatMessageParamsSchema = z.object({
    chatId: requiredTextSchema,
    messageId: requiredTextSchema
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

export const chatMessageValidation = createResourceValidation({
    getChatMessages: {
        params: chatIdParamsSchema,
        query: getChatMessagesQuerySchema
    },
    sendMessage: {
        params: chatIdParamsSchema,
        body: sendMessageSchema
    },
    editMessage: {
        params: chatMessageParamsSchema,
        body: editMessageSchema
    },
    deleteMessage: {
        schema: chatMessageParamsSchema,
        target: ValidationTarget.Params
    },
    markMessagesAsRead: {
        schema: chatIdParamsSchema,
        target: ValidationTarget.Params
    },
    toggleReaction: {
        params: chatMessageParamsSchema,
        body: toggleReactionSchema
    },
    sendFileMessage: {
        schema: chatIdParamsSchema,
        target: ValidationTarget.Params
    }
});
