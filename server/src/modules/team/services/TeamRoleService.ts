import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoleModel, {
    buildTeamRoleCreatePayload,
    buildTeamRoleUpdatePayload,
    canRenameTeamRoleTo
} from '@modules/team/models/team-role/TeamRoleModel';
import type { TeamRoleProps } from '@modules/team/models/team-role/TeamRoleModel';
import { toPersistedOutput } from '@modules/team/services/toPersistedOutput';
import TeamRoleCreatedEvent from '@modules/team/events/team-role/TeamRoleCreatedEvent';
import TeamRoleUpdatedEvent from '@modules/team/events/team-role/TeamRoleUpdatedEvent';
import TeamRoleDeletedEvent from '@modules/team/events/team-role/TeamRoleDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { CreateTeamRoleInput, UpdateTeamRoleInput } from '@volt/contracts/modules/team/http';

export default class TeamRoleService {
    #eventBus = eventBus;

    async listByTeamId(teamId: string, page = 1, limit = 10): Promise<PaginatedResult<PersistedOutput<TeamRoleProps>>> {
        const filter = { team: teamId };
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            TeamRoleModel.find(filter).skip(skip).limit(limit),
            TeamRoleModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((role) => toPersistedOutput<TeamRoleProps>(role)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getById(roleId: string): Promise<PersistedOutput<TeamRoleProps>> {
        const role = await TeamRoleModel.findById(roleId);
        if (!role) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'TeamRole not found');
        }
        return toPersistedOutput(role);
    }

    async create(teamId: string, userId: string, input: CreateTeamRoleInput): Promise<PersistedOutput<TeamRoleProps>> {
        const newRole = await TeamRoleModel.create(buildTeamRoleCreatePayload({
            teamId,
            name: input.name,
            permissions: input.permissions ?? [],
            isSystem: input.isSystem ?? false
        }));

        await this.#eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: String(newRole._id),
            teamId: String(newRole.team),
            name: newRole.name,
            userId
        }));

        return toPersistedOutput(newRole);
    }

    async updateById(roleId: string, input: UpdateTeamRoleInput): Promise<PersistedOutput<TeamRoleProps>> {
        const currentRole = await TeamRoleModel.findById(roleId);
        if (!currentRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        if (!canRenameTeamRoleTo(currentRole, input.name)) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot rename system roles');
        }

        const updateData = buildTeamRoleUpdatePayload(currentRole, { name: input.name, permissions: input.permissions });
        const teamRole = await TeamRoleModel.findByIdAndUpdate(roleId, { $set: updateData }, { new: true });
        if (!teamRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Failed to update team role');
        }

        await this.#eventBus.publish(new TeamRoleUpdatedEvent({
            teamRoleId: String(teamRole._id),
            teamId: String(teamRole.team),
            name: teamRole.name,
            permissions: teamRole.permissions
        }));

        return toPersistedOutput(teamRole);
    }

    async deleteById(teamId: string, roleId: string, userId: string): Promise<{ success: boolean }> {
        if (!userId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Authentication required');
        }

        const roleToDelete = await TeamRoleModel.findById(roleId);
        if (!roleToDelete) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }
        if (roleToDelete.isSystem) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 'Cannot delete system roles');
        }

        const memberRole = await TeamRoleModel.findOne({ team: teamId, name: 'Member', isSystem: true });
        if (!memberRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Member role not found');
        }

        await TeamMemberModel.updateMany({ team: teamId, role: roleId }, { $set: { role: memberRole._id } });

        const result = await TeamRoleModel.findByIdAndDelete(roleId);
        if (!result) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Failed to delete team role');
        }

        await this.#eventBus.publish(new TeamRoleDeletedEvent({
            teamRoleId: roleId,
            teamId,
            userId,
            roleName: roleToDelete.name ?? ''
        }));

        return { success: true };
    }
}
