import {
    createPaginationQuerySchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const paginationQuerySchema = createPaginationQuerySchema({ maxLimit: 500 });

const documentParamsSchema = teamParamsSchema.extend({
    documentId: objectIdSchema
}).strict();

const assetParamsSchema = documentParamsSchema.extend({
    assetId: objectIdSchema
}).strict();

const createDocumentBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    content: z.string().optional()
}).strict();

const updateDocumentBodySchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().optional()
}).strict().refine(
    (data) => data.title !== undefined || data.content !== undefined,
    { message: 'At least one of title or content must be provided' }
);

export const latexValidation = {
    listDocuments: {
        params: teamParamsSchema,
        query: paginationQuerySchema
    },
    createDocument: {
        params: teamParamsSchema,
        body: createDocumentBodySchema
    },
    getDocument: {
        params: documentParamsSchema
    },
    deleteDocument: {
        params: documentParamsSchema
    },
    updateDocument: {
        params: documentParamsSchema,
        body: updateDocumentBodySchema
    },
    listAssets: {
        params: documentParamsSchema
    },
    uploadAsset: {
        params: documentParamsSchema
    },
    deleteAsset: {
        params: assetParamsSchema
    }
};
