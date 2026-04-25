import {
    createFolderValidationSchemas,
    createPaginationQuerySchema,
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
    title: z.string().trim().min(1).max(255),
    folderId: objectIdSchema.nullable().optional()
}).strict();

const updateWhiteboardBodySchema = z.object({
    title: z.string().trim().min(1).max(255).optional()
}).strict();

const listWhiteboardsParamsSchema = z.object({
    teamId: objectIdSchema
}).strict();

const folderValidation = createFolderValidationSchemas();

export const whiteboardValidation = {
    createWhiteboard: {
        params: teamParamsSchema,
        body: createWhiteboardBodySchema
    },
    listWhiteboards: {
        params: listWhiteboardsParamsSchema,
        query: paginationQuerySchema.extend({
            folderId: z.string().optional()
        })
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
    },
    ...folderValidation,
    moveWhiteboard: {
        params: whiteboardParamsSchema,
        body: z.object({
            folderId: objectIdSchema.nullable()
        }).strict()
    }
};
