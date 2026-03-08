import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';

const createTeamSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500)
}).strict();

const updateTeamSchema = createTeamSchema.partial();

const removeTeamMemberSchema = z.object({
    userId: z.string().min(1)
}).strict();

export const teamValidation = {
    create: createValidationMiddleware(createTeamSchema),
    update: createValidationMiddleware(updateTeamSchema),
    removeMember: createValidationMiddleware(removeTeamMemberSchema)
};
