import { z } from 'zod';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';
import { EntityOutputDTO } from '@modules/team/application/dtos/common';

export const teamRoleNameSchema = z.string().trim().min(1, ErrorCodes.TEAM_ROLE_NAME_REQUIRED).max(100);
export const teamRolePermissionSchema = z.string().trim().min(1);
export const teamRolePermissionsSchema = z.array(teamRolePermissionSchema);

export const createTeamRoleInputSchema = z.object({
    teamId: z.string().min(1, ErrorCodes.TEAM_ID_REQUIRED),
    name: teamRoleNameSchema,
    permissions: teamRolePermissionsSchema.optional().default([]),
    isSystem: z.boolean().optional().default(false)
});

export type CreateTeamRoleInputDTO = z.input<typeof createTeamRoleInputSchema>;

export type CreateTeamRoleOutputDTO = EntityOutputDTO<TeamRoleProps>;
