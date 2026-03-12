import {
    createPaginationQuerySchema,
    objectIdSchema,
    teamParamsSchema,
    createTeamScopedParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const documentParamsSchema = teamParamsSchema.extend({
    documentId: objectIdSchema
}).strict();

const folderParamsSchema = createTeamScopedParamsSchema('folderId');

const assetParamsSchema = documentParamsSchema.extend({
    assetId: objectIdSchema
}).strict();

const fileParamsSchema = documentParamsSchema.extend({
    fileId: objectIdSchema
}).strict();

const createDocumentBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    content: z.string().optional(),
    folderId: objectIdSchema.nullable().optional()
}).strict();

const updateDocumentBodySchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().optional()
}).strict().refine(
    (data) => data.title !== undefined || data.content !== undefined,
    { message: 'At least one of title or content must be provided' }
);

const createFileBodySchema = z.object({
    name: z.string().trim().min(1).max(255),
    path: z.string().trim().max(512).optional(),
    content: z.string().optional(),
    isEntrypoint: z.boolean().optional()
}).strict();

const updateFileBodySchema = z.object({
    name: z.string().trim().min(1).max(255).optional(),
    path: z.string().trim().max(512).optional(),
    content: z.string().optional()
}).strict().refine(
    (data) => data.name !== undefined || data.path !== undefined || data.content !== undefined,
    { message: 'At least one of name, path or content must be provided' }
);

export const latexValidation = {
    listDocuments: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 500, includeSearch: true }).extend({
            folderId: z.string().optional()
        })
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
        params: documentParamsSchema,
        body: z.object({
            path: z.string().trim().min(1).max(512).optional()
        }).strict()
    },
    deleteAsset: {
        params: assetParamsSchema
    },
    updateAsset: {
        params: assetParamsSchema,
        body: z.object({
            path: z.string().trim().min(1).max(512)
        }).strict()
    },
    exportDocument: {
        params: documentParamsSchema
    },
    importDocument: {
        params: teamParamsSchema,
        body: z.object({
            folderId: objectIdSchema.nullable().optional()
        }).strict()
    },
    compileDocument: {
        params: documentParamsSchema
    },
    listFiles: {
        params: documentParamsSchema
    },
    createFile: {
        params: documentParamsSchema,
        body: createFileBodySchema
    },
    updateFile: {
        params: fileParamsSchema,
        body: updateFileBodySchema
    },
    deleteFile: {
        params: fileParamsSchema
    },
    setFileEntrypoint: {
        params: fileParamsSchema
    },
    createFolder: {
        params: teamParamsSchema,
        body: z.object({
            title: z.string().trim().min(1).max(255),
            parentId: objectIdSchema.nullable().optional()
        }).strict()
    },
    listFolders: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 500 }).extend({
            parentId: z.string().optional()
        })
    },
    getFolder: {
        params: folderParamsSchema
    },
    updateFolder: {
        params: folderParamsSchema,
        body: z.object({
            title: z.string().trim().min(1).max(255)
        }).strict()
    },
    deleteFolder: {
        params: folderParamsSchema
    },
    moveDocument: {
        params: documentParamsSchema,
        body: z.object({
            folderId: objectIdSchema.nullable()
        }).strict()
    }
};
