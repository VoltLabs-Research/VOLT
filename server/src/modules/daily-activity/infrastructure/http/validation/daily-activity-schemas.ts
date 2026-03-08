import { z } from 'zod/v4';

const teamIdParamsSchema = z.object({
    teamId: z.string().trim().min(1)
}).strict();

const findActivityQuerySchema = z.object({
    range: z.coerce.number().int().min(1).max(365).default(7)
}).strict();

export const dailyActivityValidation = {
    findByTeamId: {
        params: teamIdParamsSchema,
        query: findActivityQuerySchema
    }
};
