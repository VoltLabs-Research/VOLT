import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const identifierSchema = z.string().min(1);

const paginationQuerySchema = createPaginationQuerySchema({
    maxLimit: 100,
    includeSearch: true
});

const byTeamParamsSchema = z.object({
    teamId: identifierSchema
}).strict();

const byContainerParamsSchema = byTeamParamsSchema.extend({
    containerId: identifierSchema
}).strict();

const byContainerPortParamsSchema = byContainerParamsSchema.extend({
    privatePort: z.coerce.number().int().min(1).max(65535)
}).strict();

const byFolderParamsSchema = byTeamParamsSchema.extend({
    folderId: identifierSchema
}).strict();

const containerPathQuerySchema = z.object({
    path: z.string().min(1)
}).strict();

const containerDirectoryQuerySchema = z.object({
    path: z.string().min(1).optional()
}).strict();

const environmentVariableSchema = z.object({
    key: z.string().min(1),
    value: z.string()
}).strict();

const publicPortSchema = z.preprocess(
    (value) => value === 0 ? undefined : value,
    z.number().int().min(1).max(65535).optional()
);

const portMappingSchema = z.object({
    private: z.number().int().min(1).max(65535),
    public: publicPortSchema
}).strict();

const createContainerSchema = z.object({
    name: z.string().min(1),
    image: z.string().min(1),
    operationId: z.string().min(1).optional(),
    teamClusterId: identifierSchema.optional(),
    folderId: identifierSchema.nullable().optional(),
    env: z.array(environmentVariableSchema).optional(),
    ports: z.array(portMappingSchema).optional(),
    cmd: z.array(z.string()).optional(),
    memory: z.number().positive().optional(),
    cpus: z.number().positive().optional(),
    mountDockerSocket: z.boolean().optional(),
    useImageCmd: z.boolean().optional()
}).strict();

const updateContainerSchema = z.object({
    action: z.enum(['start', 'stop', 'restart']).optional(),
    env: z.array(environmentVariableSchema).optional(),
    ports: z.array(portMappingSchema).optional()
}).strict();

const createFolderSchema = z.object({
    title: z.string().trim().min(1).max(255),
    parentId: identifierSchema.nullable().optional()
}).strict();

const updateFolderSchema = z.object({
    title: z.string().trim().min(1).max(255)
}).strict();

const moveContainerSchema = z.object({
    folderId: identifierSchema.nullable()
}).strict();

export const containerValidation = {
    create: {
        params: byTeamParamsSchema,
        body: createContainerSchema
    },
    createPortProxySession: {
        params: byContainerPortParamsSchema
    },
    update: {
        params: byContainerParamsSchema,
        body: updateContainerSchema
    },
    move: {
        params: byContainerParamsSchema,
        body: moveContainerSchema
    },
    list: {
        params: byTeamParamsSchema,
        query: paginationQuerySchema.extend({
            folderId: z.string().optional()
        })
    },
    createFolder: {
        params: byTeamParamsSchema,
        body: createFolderSchema
    },
    listFolders: {
        params: byTeamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 500 }).extend({
            parentId: z.string().optional()
        })
    },
    getFolder: {
        params: byFolderParamsSchema
    },
    updateFolder: {
        params: byFolderParamsSchema,
        body: updateFolderSchema
    },
    deleteFolder: {
        params: byFolderParamsSchema
    },
    byId: {
        params: byContainerParamsSchema
    },
    files: {
        params: byContainerParamsSchema,
        query: containerDirectoryQuerySchema
    },
    readFile: {
        params: byContainerParamsSchema,
        query: containerPathQuerySchema
    }
};
