import { ErrorCodes } from '@core/constants/error-codes';
import { EntityOutputDTO } from '@modules/team/application/dtos/common';
import { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import { z } from 'zod';

export type CreateTeamRoleInputDTO = z.input<typeof createTeamRoleInputSchema>;

export type CreateTeamRoleOutputDTO = EntityOutputDTO<TeamRoleProps>;

export const teamRoleNameSchema = z.string().trim().min(1, ErrorCodes.TEAM_ROLE_NAME_REQUIRED).max(100);

export const teamRolePermissionSchema = z.string().trim().min(1);

export const teamRolePermissionsSchema = z.array(teamRolePermissionSchema);

export const createTeamRoleInputSchema = z.object({
    teamId: z.string().min(1, ErrorCodes.TEAM_ID_REQUIRED),
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.optional().default([]),
    isSystem: z.boolean().optional().default(false)
});
