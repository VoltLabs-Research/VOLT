import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createTeamScopedParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const updateTeamMemberSchema = z.object({
    role: z.string().min(1).optional()
}).strict();

const deleteTeamMemberParamsSchema = createTeamScopedParamsSchema('memberId');

export const teamMemberValidation = createResourceValidation({
    update: updateTeamMemberSchema,
    deleteById: {
        params: deleteTeamMemberParamsSchema
    }
});
