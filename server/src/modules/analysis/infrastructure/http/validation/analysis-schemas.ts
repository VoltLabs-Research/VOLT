import { createPaginationQuerySchema, createTeamScopedParamsSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

const paginationQuerySchema = createPaginationQuerySchema({
    maxLimit: 100
});

const analysisParamsSchema = createTeamScopedParamsSchema('analysisId');

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
    deleteById: {
        params: analysisParamsSchema
    },
    retryFailedFrames: {
        params: analysisParamsSchema
    }
};
