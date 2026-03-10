import { z } from 'zod/v4';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createPaginationQuerySchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { requiredTextSchema } from '@shared/infrastructure/http/validation/resource-schemas';

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

export const sshConnectionValidation = createResourceValidation({
    listByTeamId: {
        params: teamIdParamsSchema,
        query: listSSHConnectionsQuerySchema
    },
    create: {
        params: teamIdParamsSchema,
        body: createSSHConnectionSchema
    },
    getById: {
        params: sshConnectionParamsSchema
    },
    update: {
        params: sshConnectionParamsSchema,
        body: updateSSHConnectionSchema
    },
    deleteById: {
        params: sshConnectionParamsSchema
    },
    listFiles: {
        params: sshConnectionParamsSchema,
        query: listSSHFilesQuerySchema
    },
    testById: {
        params: sshConnectionParamsSchema
    },
    importTrajectory: {
        params: sshConnectionParamsSchema,
        body: importTrajectoryFromSSHSchema
    }
});
