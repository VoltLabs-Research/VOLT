import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const paginationQuerySchema = createPaginationQuerySchema({ maxLimit: 500 });

const listNotebookParamsSchema = z.object({
    teamId: objectIdSchema,
    trajectoryId: objectIdSchema.optional()
}).strict();

const teamTrajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const notebookParamsSchema = teamParamsSchema.extend({
    notebookId: objectIdSchema
}).strict();

const createJupyterSessionSchema = z.object({
    notebookId: objectIdSchema.optional()
}).strict();

export const scriptingValidation = {
    listNotebooks: {
        params: listNotebookParamsSchema,
        query: paginationQuerySchema
    },
    createJupyterSession: {
        params: teamTrajectoryParamsSchema,
        body: createJupyterSessionSchema
    },
    deleteNotebook: {
        params: notebookParamsSchema
    }
};
