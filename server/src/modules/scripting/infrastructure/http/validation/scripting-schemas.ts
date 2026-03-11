import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const paginationQuerySchema = createPaginationQuerySchema({ maxLimit: 500 }).extend({
    scope: z.enum(['all', 'general', 'trajectory']).optional()
}).strict();

const listNotebookParamsSchema = z.object({
    teamId: objectIdSchema,
    trajectoryId: objectIdSchema.optional()
}).strict();

const teamTrajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const notebookParamsSchema = teamParamsSchema.extend({
    notebookId: objectIdSchema
}).strict();

const createNotebookSchema = z.object({
    title: z.string().trim().min(1).max(255).optional()
}).strict();

const updateNotebookSchema = z.object({
    title: z.string().trim().min(1).max(255)
}).strict();

const createJupyterSessionSchema = z.object({
    notebookId: objectIdSchema.optional(),
    teamClusterId: objectIdSchema.optional()
}).strict();

const createNotebookJupyterSessionSchema = z.object({
    notebookId: objectIdSchema,
    teamClusterId: objectIdSchema.optional()
}).strict();

export const scriptingValidation = {
    listNotebooks: {
        params: listNotebookParamsSchema,
        query: paginationQuerySchema
    },
    createNotebook: {
        params: teamParamsSchema,
        body: createNotebookSchema
    },
    updateNotebook: {
        params: notebookParamsSchema,
        body: updateNotebookSchema
    },
    createJupyterSession: {
        params: teamTrajectoryParamsSchema,
        body: createJupyterSessionSchema
    },
    createNotebookJupyterSession: {
        params: teamParamsSchema,
        body: createNotebookJupyterSessionSchema
    },
    deleteNotebook: {
        params: notebookParamsSchema
    }
};
