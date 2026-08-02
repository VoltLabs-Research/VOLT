import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { CreateTeamRoleInput, UpdateTeamRoleInput } from '@volt/contracts/modules/team/http';

const DEFAULT_ROLE_LIMIT = 10;

export default class TeamRoleService{
    async listByTeamId(teamId: string, page = 1, limit = DEFAULT_ROLE_LIMIT): Promise<PaginatedResult<TeamRole>>{
        const pageRequest = readPageRequest(page, limit, { defaultLimit: DEFAULT_ROLE_LIMIT });

        const [roles, total] = await TeamRole.findAndCount({
            where: { team: teamId },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([roles, total], pageRequest);
    }

    async getById(roleId: string): Promise<TeamRole>{
        const role = await TeamRole.findOneBy({ id: roleId });
        if(!role){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'TeamRole not found');
        }
        return role;
    }

    async create(teamId: string, userId: string, input: CreateTeamRoleInput): Promise<TeamRole>{
        const newRole = await TeamRole.create({
            team: teamId,
            name: input.name,
            permissions: [...new Set(input.permissions ?? [])],
            isSystem: input.isSystem ?? false
        }).save();

        await eventBus.emit('team-role.created', {
            teamRoleId: newRole.id,
            teamId: newRole.team,
            name: newRole.name,
            userId
        });

        return newRole;
    }

    async updateById(roleId: string, input: UpdateTeamRoleInput): Promise<TeamRole>{
        const currentRole = await TeamRole.findOneBy({ id: roleId });
        if(!currentRole){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }
        if(currentRole.isSystem && input.name && input.name !== currentRole.name){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot rename system roles');
        }

        const teamRole = await Object.assign(currentRole, {
            ...(input.permissions !== undefined && { permissions: input.permissions }),
            ...(!currentRole.isSystem && input.name !== undefined && { name: input.name })
        }).save();

        await eventBus.emit('team-role.updated', {
            teamRoleId: teamRole.id,
            teamId: teamRole.team,
            name: teamRole.name,
            permissions: teamRole.permissions ?? []
        });

        return teamRole;
    }

    async deleteById(teamId: string, roleId: string, userId: string): Promise<{ success: boolean }>{
        const roleToDelete = await TeamRole.findOneBy({ id: roleId });
        if(!roleToDelete){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }
        if(roleToDelete.isSystem){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot delete system roles');
        }

        const memberRole = await TeamRole.findOneBy({
            team: teamId,
            name: 'Member',
            isSystem: true
        });
        if(!memberRole){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Member role not found');
        }

        await TeamMember.update({
            team: teamId,
            role: roleId
        }, { role: memberRole.id });

        await roleToDelete.remove();

        await eventBus.emit('team-role.deleted', {
            teamRoleId: roleId,
            teamId,
            userId,
            roleName: roleToDelete.name ?? ''
        });

        return { success: true };
    }
}
