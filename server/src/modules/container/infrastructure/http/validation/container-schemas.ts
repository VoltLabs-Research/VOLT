import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const identifierSchema = z.string().min(1);
const httpOriginSchema = z.string().url().refine((value) => /^https?:\/\//.test(value), {
    message: 'Expected an HTTP(S) origin'
});

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

const containerCapabilitiesSchema = z.object({
    vnc: z.boolean().optional()
}).strict();

const createContainerSchema = z.object({
    name: z.string().min(1),
    image: z.string().min(1),
    teamClusterId: identifierSchema.optional(),
    folderId: identifierSchema.nullable().optional(),
    env: z.array(environmentVariableSchema).optional(),
    ports: z.array(portMappingSchema).optional(),
    cmd: z.array(z.string()).optional(),
    memory: z.number().positive().optional(),
    cpus: z.number().positive().optional(),
    mountDockerSocket: z.boolean().optional(),
    useImageCmd: z.boolean().optional(),
    capabilities: containerCapabilitiesSchema.optional()
}).strict();

const updateContainerSchema = z.object({
    action: z.enum(['start', 'stop', 'restart']).optional(),
    env: z.array(environmentVariableSchema).optional(),
    ports: z.array(portMappingSchema).optional()
}).strict();

const createFolderSchema = z.object({
    title: z.string().min(1).max(255),
    parentId: identifierSchema.nullable().optional()
}).strict();

const updateFolderSchema = z.object({
    title: z.string().min(1).max(255)
}).strict();

const moveContainerSchema = z.object({
    folderId: identifierSchema.nullable()
}).strict();

const createContainerVncSessionSchema = z.object({
    password: z.string().min(1),
    parentOrigin: httpOriginSchema,
    width: z.number().int().positive().max(8192).optional(),
    height: z.number().int().positive().max(4320).optional(),
    dpi: z.number().int().positive().max(300).optional()
}).strict();

const getContainerVncConnectPageQuerySchema = z.object({
    token: z.string().min(1),
    parentOrigin: httpOriginSchema
}).strict();

export const containerValidation = {
    create: {
        params: byTeamParamsSchema,
        body: createContainerSchema
    },
    createVncSession: {
        params: byContainerParamsSchema,
        body: createContainerVncSessionSchema
    },
    createPortProxySession: {
        params: byContainerPortParamsSchema
    },
    getVncConnectPage: {
        params: byContainerParamsSchema,
        query: getContainerVncConnectPageQuerySchema
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
