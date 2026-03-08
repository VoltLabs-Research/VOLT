import { z } from 'zod/v4';
import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    objectIdSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';

const paginationQuerySchema = createPaginationQuerySchema({ maxLimit: 200 }).extend({
    trajectoryId: objectIdSchema.optional(),
    timestep: z.coerce.number().int().min(0).optional()
}).strict();

const simulationCellParamsSchema = createTeamScopedParamsSchema('simulationCellId');

const byTrajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const byTrajectoryQuerySchema = z.object({
    timestep: z.coerce.number().int().min(0).optional()
}).strict();

export const simulationCellValidationSchemas = {
    listByTeamId: {
        params: teamParamsSchema,
        query: paginationQuerySchema
    },
    getById: {
        params: simulationCellParamsSchema
    },
    getByTrajectory: {
        params: byTrajectoryParamsSchema,
        query: byTrajectoryQuerySchema
    }
};
