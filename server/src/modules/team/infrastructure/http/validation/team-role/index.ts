import { teamRoleNameSchema, teamRolePermissionsSchema } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { z } from 'zod/v4';

const createTeamRoleSchema = z.object({
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.min(1)
}).strict();

const updateTeamRoleSchema = createTeamRoleSchema.partial();

export const teamRoleValidation = createResourceValidation({
    create: createTeamRoleSchema,
    update: updateTeamRoleSchema
});
