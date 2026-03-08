import { createValidationMiddleware, ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const idSchema = z.string().trim().min(1);

const getOrCreateChatParamsSchema = z.object({
    teamId: idSchema,
    targetUserId: idSchema
}).strict();

const chatIdParamsSchema = z.object({
    chatId: idSchema
}).strict();

const createGroupSchema = z.object({
    teamId: idSchema,
    groupName: z.string().trim().min(1).max(100),
    groupDescription: z.string().max(500).optional(),
    participantIds: z.array(idSchema).min(1)
}).strict();

const addUsersSchema = z.object({
    userIds: z.array(idSchema).min(1)
}).strict();

const removeUsersSchema = z.object({
    userIds: z.array(idSchema).min(1)
}).strict();

const updateGroupInfoSchema = z.object({
    groupName: z.string().trim().min(1).max(100),
    groupDescription: z.string().max(500)
}).strict().partial();

const updateGroupAdminsSchema = z.object({
    targetUserIds: z.array(idSchema).min(1),
    action: z.enum(['add', 'remove'])
}).strict();

export const chatValidation = {
    getOrCreate: createValidationMiddleware(getOrCreateChatParamsSchema, ValidationTarget.Params),
    createGroup: createValidationMiddleware(createGroupSchema),
    addUsers: createValidationMiddleware({
        params: chatIdParamsSchema,
        body: addUsersSchema
    }),
    removeUsers: createValidationMiddleware({
        params: chatIdParamsSchema,
        body: removeUsersSchema
    }),
    updateGroupInfo: createValidationMiddleware({
        params: chatIdParamsSchema,
        body: updateGroupInfoSchema
    }),
    updateGroupAdmins: createValidationMiddleware({
        params: chatIdParamsSchema,
        body: updateGroupAdminsSchema
    }),
    leaveGroup: createValidationMiddleware(chatIdParamsSchema, ValidationTarget.Params)
};
