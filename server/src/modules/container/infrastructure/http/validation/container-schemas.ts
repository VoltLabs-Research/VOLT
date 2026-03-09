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

const portMappingSchema = z.object({
    private: z.number().int().min(1).max(65535),
    public: z.number().int().min(1).max(65535)
}).strict();

const createContainerSchema = z.object({
    name: z.string().min(1),
    image: z.string().min(1),
    teamClusterId: identifierSchema.optional(),
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

export const containerValidation = {
    create: {
        params: byTeamParamsSchema,
        body: createContainerSchema
    },
    update: {
        params: byContainerParamsSchema,
        body: updateContainerSchema
    },
    list: {
        params: byTeamParamsSchema,
        query: paginationQuerySchema
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
