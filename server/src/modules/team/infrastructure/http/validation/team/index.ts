import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createNamedResourceSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { createTeamScopedParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

const createTeamSchema = createNamedResourceSchema();

const updateTeamSchema = createTeamSchema.partial();

const removeTeamMemberParamsSchema = createTeamScopedParamsSchema('userId');

export const teamValidation = createResourceValidation({
    create: createTeamSchema,
    update: updateTeamSchema,
    removeMember: {
        params: removeTeamMemberParamsSchema
    }
});
