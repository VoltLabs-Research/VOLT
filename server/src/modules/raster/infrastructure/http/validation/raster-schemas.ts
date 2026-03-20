import { createTeamScopedParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const teamTrajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const frameParamsSchema = teamTrajectoryParamsSchema.extend({
    timestep: z.coerce.number().int().min(0),
    analysisId: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional()
}).strict();

const triggerBodySchema = z.object({
    config: z.record(z.string(), z.unknown()).optional()
}).strict().optional();

export const rasterValidation = {
    trigger: {
        params: teamTrajectoryParamsSchema,
        body: triggerBodySchema
    },
    metadata: {
        params: teamTrajectoryParamsSchema
    },
    frame: {
        params: frameParamsSchema
    }
};
