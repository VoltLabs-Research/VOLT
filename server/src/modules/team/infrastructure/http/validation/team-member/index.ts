import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const updateTeamMemberSchema = z.object({
    role: z.string().min(1).optional()
}).strict();

export const teamMemberValidation = {
    update: createValidationMiddleware(updateTeamMemberSchema)
};
