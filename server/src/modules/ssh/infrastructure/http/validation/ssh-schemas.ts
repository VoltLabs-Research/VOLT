import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';

const requiredTextSchema = z.string().trim().min(1);

const teamIdParamsSchema = z.object({
    teamId: requiredTextSchema
}).strict();

const sshConnectionParamsSchema = teamIdParamsSchema.extend({
    sshConnectionId: requiredTextSchema
}).strict();

const listSSHConnectionsQuerySchema = createPaginationQuerySchema({ maxLimit: 100 });

const listSSHFilesQuerySchema = z.object({
    path: requiredTextSchema.optional()
}).strict();

const createSSHConnectionSchema = z.object({
    name: requiredTextSchema.max(100),
    host: requiredTextSchema,
    port: z.number().int().min(1).max(65535),
    username: requiredTextSchema,
    password: requiredTextSchema
}).strict();

const updateSSHConnectionSchema = z.object({
    name: requiredTextSchema.max(100),
    host: requiredTextSchema,
    port: z.number().int().min(1).max(65535),
    username: requiredTextSchema,
    password: requiredTextSchema
}).strict().partial();

const importTrajectoryFromSSHSchema = z.object({
    remotePath: requiredTextSchema
}).strict();

export const sshConnectionValidation = {
    listByTeamId: createValidationMiddleware({
        params: teamIdParamsSchema,
        query: listSSHConnectionsQuerySchema
    }),
    create: createValidationMiddleware({
        params: teamIdParamsSchema,
        body: createSSHConnectionSchema
    }),
    getById: createValidationMiddleware({
        params: sshConnectionParamsSchema
    }),
    update: createValidationMiddleware({
        params: sshConnectionParamsSchema,
        body: updateSSHConnectionSchema
    }),
    deleteById: createValidationMiddleware({
        params: sshConnectionParamsSchema
    }),
    listFiles: createValidationMiddleware({
        params: sshConnectionParamsSchema,
        query: listSSHFilesQuerySchema
    }),
    testById: createValidationMiddleware({
        params: sshConnectionParamsSchema
    }),
    importTrajectory: createValidationMiddleware({
        params: sshConnectionParamsSchema,
        body: importTrajectoryFromSSHSchema
    })
};
