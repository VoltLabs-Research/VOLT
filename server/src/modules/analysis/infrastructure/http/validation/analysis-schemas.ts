import { z } from 'zod/v4';
import { createPaginationQuerySchema, createTeamScopedParamsSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

const paginationQuerySchema = createPaginationQuerySchema({
    maxLimit: 100,
    includeSearch: true
});

const analysisParamsSchema = createTeamScopedParamsSchema('analysisId');
const analysisLogParamsSchema = teamParamsSchema.extend({
    analysisId: z.string().trim().min(1),
    timestep: z.coerce.number().int()
});

const trajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

export const analysisValidation = {
    listByTeamId: {
        params: teamParamsSchema,
        query: paginationQuerySchema
    },
    listByTrajectoryId: {
        params: trajectoryParamsSchema,
        query: paginationQuerySchema
    },
    getById: {
        params: analysisParamsSchema
    },
    getFrameLog: {
        params: analysisLogParamsSchema,
        query: z.object({
            afterCursor: z.string().trim().min(1).optional()
        }).strict()
    },
    deleteById: {
        params: analysisParamsSchema
    },
    retryFailedFrames: {
        params: analysisParamsSchema
    }
};
