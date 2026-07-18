import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import TeamRole from '@modules/team/entities/team-role/TeamRole';
import type { TeamRoleProps } from '@modules/team/entities/team-role/TeamRole';
import TeamRoleCreatedEvent from '@modules/team/events/team-role/TeamRoleCreatedEvent';
import TeamRoleUpdatedEvent from '@modules/team/events/team-role/TeamRoleUpdatedEvent';
import TeamRoleDeletedEvent from '@modules/team/events/team-role/TeamRoleDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import type { CreateTeamRoleInput, UpdateTeamRoleInput } from '@volt/contracts/modules/team/http';

/**
 * The single application service for the team-role resource. Folds the former
 * list/get/create/update/delete use-cases (the list/get logic previously lived
 * inline in the route file). The role/member repositories are shared singletons
 * (the membership orchestrator and event handlers use the role repository too),
 * resolved once from the DI container.
 */
export default class TeamRoleService {
    #roles = diContainer.resolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository);
    #members = diContainer.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async listByTeamId(teamId: string, page = 1, limit = 10): Promise<PaginatedResult<PersistedOutput<TeamRoleProps>>> {
        const result = await this.#roles.findAll({ filter: { team: teamId }, page, limit });
        return { ...result, data: result.data.map((role) => toPersistedOutput(role)) };
    }

    async getById(roleId: string): Promise<PersistedOutput<TeamRoleProps>> {
        const role = await this.#roles.findById(roleId);
        if (!role) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'TeamRole not found');
        }
        return toPersistedOutput(role);
    }

    async create(teamId: string, userId: string, input: CreateTeamRoleInput): Promise<PersistedOutput<TeamRoleProps>> {
        const newRole = await this.#roles.create(TeamRole.create({
            teamId,
            name: input.name,
            permissions: input.permissions ?? [],
            isSystem: input.isSystem ?? false
        }));

        await this.#eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: newRole._id,
            teamId: String(newRole.props.team),
            name: newRole.props.name,
            userId
        }));

        return toPersistedOutput(newRole);
    }

    async updateById(roleId: string, input: UpdateTeamRoleInput): Promise<PersistedOutput<TeamRoleProps>> {
        const currentRole = await this.#roles.findById(roleId);
        if (!currentRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        if (!currentRole.canRenameTo(input.name)) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot rename system roles');
        }

        const updateData = currentRole.getUpdatePayload({ name: input.name, permissions: input.permissions });
        const teamRole = await this.#roles.updateById(roleId, updateData);
        if (!teamRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Failed to update team role');
        }

        await this.#eventBus.publish(new TeamRoleUpdatedEvent({
            teamRoleId: teamRole._id,
            teamId: String(teamRole.props.team),
            name: teamRole.props.name,
            permissions: teamRole.props.permissions
        }));

        return toPersistedOutput(teamRole);
    }

    async deleteById(teamId: string, roleId: string, userId: string): Promise<{ success: boolean }> {
        if (!userId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Authentication required');
        }

        const roleToDelete = await this.#roles.findById(roleId);
        if (!roleToDelete) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }
        if (roleToDelete.props.isSystem) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot delete system roles');
        }

        const memberRole = await this.#roles.findOne({ team: teamId, name: 'Member', isSystem: true });
        if (!memberRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Member role not found');
        }

        await this.#members.updateMany({ team: teamId, role: roleId }, { role: memberRole._id });

        const result = await this.#roles.deleteById(roleId);
        if (!result) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Failed to delete team role');
        }

        await this.#eventBus.publish(new TeamRoleDeletedEvent({
            teamRoleId: roleId,
            teamId,
            userId,
            roleName: roleToDelete.props.name ?? ''
        }));

        return { success: true };
    }
}
