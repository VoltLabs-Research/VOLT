import { ValidationTarget } from '@shared/infrastructure/http/middleware/validation';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { requiredTextSchema, resourceDescriptionSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { z } from 'zod/v4';

const getOrCreateChatParamsSchema = z.object({
    teamId: requiredTextSchema,
    targetUserId: requiredTextSchema
}).strict();

const chatIdParamsSchema = z.object({
    chatId: requiredTextSchema
}).strict();

const createGroupSchema = z.object({
    teamId: requiredTextSchema,
    groupName: requiredTextSchema.max(100),
    groupDescription: resourceDescriptionSchema.optional(),
    participantIds: z.array(requiredTextSchema).min(1)
}).strict();

const addUsersSchema = z.object({
    userIds: z.array(requiredTextSchema).min(1)
}).strict();

const removeUsersSchema = z.object({
    userIds: z.array(requiredTextSchema).min(1)
}).strict();

const updateGroupInfoSchema = z.object({
    groupName: requiredTextSchema.max(100),
    groupDescription: resourceDescriptionSchema
}).strict().partial();

const updateGroupAdminsSchema = z.object({
    targetUserIds: z.array(requiredTextSchema).min(1),
    action: z.enum(['add', 'remove'])
}).strict();

export const chatValidation = createResourceValidation({
    getOrCreate: {
        schema: getOrCreateChatParamsSchema,
        target: ValidationTarget.Params
    },
    createGroup: createGroupSchema,
    addUsers: {
        params: chatIdParamsSchema,
        body: addUsersSchema
    },
    removeUsers: {
        params: chatIdParamsSchema,
        body: removeUsersSchema
    },
    updateGroupInfo: {
        params: chatIdParamsSchema,
        body: updateGroupInfoSchema
    },
    updateGroupAdmins: {
        params: chatIdParamsSchema,
        body: updateGroupAdminsSchema
    },
    leaveGroup: {
        schema: chatIdParamsSchema,
        target: ValidationTarget.Params
    }
});
