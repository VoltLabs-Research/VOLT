import { teamRoleNameSchema, teamRolePermissionsSchema } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const createTeamRoleSchema = z.object({
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.min(1)
}).strict();

const updateTeamRoleSchema = createTeamRoleSchema.partial();

export const teamRoleValidation = {
    create: createValidationMiddleware(createTeamRoleSchema),
    update: createValidationMiddleware(updateTeamRoleSchema)
};
