import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const updateTeamMemberSchema = z.object({
    role: z.string().min(1).optional()
}).strict();

const teamMemberParamsSchema = createTeamScopedParamsSchema('teamMemberId');
const deleteTeamMemberParamsSchema = createTeamScopedParamsSchema('memberId');

export const teamMemberValidation = createResourceValidation({
    list: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 200 })
    },
    getById: {
        params: teamMemberParamsSchema
    },
    update: {
        params: teamMemberParamsSchema,
        body: updateTeamMemberSchema
    },
    deleteById: {
        params: deleteTeamMemberParamsSchema
    }
});
