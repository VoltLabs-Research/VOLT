import { z } from 'zod/v4';

const teamJobParamsSchema = z.object({
    teamId: z.string().min(1)
}).strict();

export const jobsValidation = {
    teamAction: {
        params: teamJobParamsSchema
    }
};
