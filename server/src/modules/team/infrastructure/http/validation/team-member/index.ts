import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { z } from 'zod/v4';

const updateTeamMemberSchema = z.object({
    role: z.string().min(1).optional()
}).strict();

export const teamMemberValidation = createResourceValidation({
    update: updateTeamMemberSchema
});
