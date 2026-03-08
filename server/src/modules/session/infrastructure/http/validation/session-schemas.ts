import {
    createObjectIdParamsSchema,
    createPaginationQuerySchema,
    objectIdSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const tokenSchema = z.string().trim().min(1);

const userRequestContextSchema = z.object({
    userId: objectIdSchema,
    token: tokenSchema.optional(),
    sessionId: objectIdSchema.optional()
}).strict();

const revokeAllRequestContextSchema = userRequestContextSchema.extend({
    token: tokenSchema
}).strict();

const sessionParamsSchema = createObjectIdParamsSchema(['sessionId']);

const loginActivityQuerySchema = createPaginationQuerySchema({
    maxLimit: 100
}).pick({
    limit: true
}).strict();

export const sessionValidation = {
    getActiveSessions: {
        request: userRequestContextSchema
    },
    getLoginActivity: {
        query: loginActivityQuerySchema,
        request: userRequestContextSchema
    },
    revokeById: {
        params: sessionParamsSchema,
        request: userRequestContextSchema
    },
    revokeAllOthers: {
        request: revokeAllRequestContextSchema
    }
};
