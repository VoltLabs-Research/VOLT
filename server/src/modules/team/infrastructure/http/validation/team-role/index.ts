import { teamRoleNameSchema, teamRolePermissionsSchema } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    teamParamsSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const createTeamRoleSchema = z.object({
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.min(1)
}).strict();

const updateTeamRoleSchema = createTeamRoleSchema.partial();
const teamRoleParamsSchema = createTeamScopedParamsSchema('roleId');

export const teamRoleValidation = createResourceValidation({
    list: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 200 })
    },
    getById: {
        params: teamRoleParamsSchema
    },
    create: createTeamRoleSchema,
    update: {
        params: teamRoleParamsSchema,
        body: updateTeamRoleSchema
    },
    deleteById: {
        params: teamRoleParamsSchema
    }
});
