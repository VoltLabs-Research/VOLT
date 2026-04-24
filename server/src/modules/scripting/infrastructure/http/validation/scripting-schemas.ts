import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const notebookContainerResourcesSchema = z.object({
    cpus: z.number().min(0.5).multipleOf(0.5),
    memoryMB: z.number().int().min(128)
}).strict();

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
    title: z.string().trim().min(1).max(255).optional(),
    teamClusterId: objectIdSchema,
    containerResources: notebookContainerResourcesSchema
}).strict();

const updateNotebookSchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    teamClusterId: objectIdSchema.optional(),
    containerResources: notebookContainerResourcesSchema.optional()
}).strict().refine((value) => {
    return value.title !== undefined
        || value.teamClusterId !== undefined
        || value.containerResources !== undefined;
}, {
    message: 'At least one notebook field must be provided'
});

const createJupyterSessionSchema = z.object({
    notebookId: objectIdSchema.optional(),
    teamClusterId: objectIdSchema.optional(),
    containerResources: notebookContainerResourcesSchema.optional()
}).strict().superRefine((value, context) => {
    if (value.notebookId) {
        if (value.teamClusterId !== undefined || value.containerResources !== undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Existing notebooks use their saved deployment configuration'
            });
        }
        return;
    }

    if (value.teamClusterId === undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'teamClusterId is required when creating a notebook session'
        });
    }

    if (value.containerResources === undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'containerResources are required when creating a notebook session'
        });
    }
});

const createNotebookJupyterSessionSchema = z.object({
    notebookId: objectIdSchema
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
    },
    sessionStatus: {
        params: notebookParamsSchema
    }
};
