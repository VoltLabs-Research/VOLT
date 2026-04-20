import { z } from 'zod/v4';

const trajectoryJobParamsSchema = z.object({
    teamId: z.string().min(1),
    trajectoryId: z.string().min(1)
}).strict();

export const jobsValidation = {
    trajectoryAction: {
        params: trajectoryJobParamsSchema
    }
};
