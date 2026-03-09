import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { createTeamScopedParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const createTeamSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500)
}).strict();

const updateTeamSchema = createTeamSchema.partial();

const removeTeamMemberParamsSchema = createTeamScopedParamsSchema('userId');

export const teamValidation = {
    create: createValidationMiddleware(createTeamSchema),
    update: createValidationMiddleware(updateTeamSchema),
    removeMember: createValidationMiddleware({
        params: removeTeamMemberParamsSchema
    })
};
