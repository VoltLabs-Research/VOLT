import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const paginationQuerySchema = createPaginationQuerySchema({ maxLimit: 500 });

const whiteboardParamsSchema = teamParamsSchema.extend({
    whiteboardId: objectIdSchema
}).strict();

const assetParamsSchema = whiteboardParamsSchema.extend({
    assetId: z.string().trim().min(1)
}).strict();

const createWhiteboardBodySchema = z.object({
    title: z.string().trim().min(1).max(255)
}).strict();

const updateWhiteboardBodySchema = z.object({
    title: z.string().trim().min(1).max(255).optional()
}).strict();

const listWhiteboardsParamsSchema = z.object({
    teamId: objectIdSchema
}).strict();

export const whiteboardValidation = {
    createWhiteboard: {
        params: createTeamScopedParamsSchema('teamId').omit({ teamId: true }).default({}).optional(),
        body: createWhiteboardBodySchema
    },
    listWhiteboards: {
        params: listWhiteboardsParamsSchema,
        query: paginationQuerySchema
    },
    getWhiteboard: {
        params: whiteboardParamsSchema
    },
    updateWhiteboard: {
        params: whiteboardParamsSchema,
        body: updateWhiteboardBodySchema
    },
    deleteWhiteboard: {
        params: whiteboardParamsSchema
    },
    getWhiteboardState: {
        params: whiteboardParamsSchema
    },
    saveWhiteboardState: {
        params: whiteboardParamsSchema
    },
    uploadWhiteboardAsset: {
        params: whiteboardParamsSchema
    },
    getWhiteboardAsset: {
        params: assetParamsSchema
    }
};
