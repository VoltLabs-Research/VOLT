import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import {
    teamRoleNameSchema,
    teamRolePermissionsSchema
} from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';

const createTeamRoleSchema = z.object({
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.min(1)
}).strict();

const updateTeamRoleSchema = createTeamRoleSchema.partial();

export const teamRoleValidation = {
    create: createValidationMiddleware(createTeamRoleSchema),
    update: createValidationMiddleware(updateTeamRoleSchema)
};
