import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import UserModel from '@modules/auth/models/UserModel';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamMembershipService } from '@modules/team/ports/team/ITeamMembershipService';
import TeamRole from '@modules/team/entities/team-role/TeamRole';
import {
    getTeamMemberRolePermissions,
    isPopulatedTeamMemberRole
} from '@modules/team/entities/team-member/TeamMember';
import type { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import type { TeamProps } from '@modules/team/entities/team/Team';
import TeamCreatedEvent from '@modules/team/events/team/TeamCreatedEvent';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { IDeploymentSettingsRepository } from '@shared/contracts/ports';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import type {
    CreateTeamInput,
    UpdateTeamInput
} from '@volt/contracts/modules/team/http';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_LENGTH = 5;
const MANAGE_INVITE_CODES_MESSAGE = 'You do not have permission to manage invite codes';

const generateCode = (): string => {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
    }
    return code;
};

const normalizeInviteCode = (code: string): string => code.trim().toUpperCase();

interface PopulatedTeamOwner {
    props: {
        firstName?: string;
        lastName?: string;
    };
}

/**
 * The single application service for the team resource (pollium style): folds
 * every former team use-case verbatim. Because the team module is the RBAC
 * kernel, its Mongoose-backed repositories and the membership orchestrator are
 * genuinely-shared singletons — consumed cross-module (chat/dashboard/auth/…)
 * and by the module's own event handlers — so this service resolves them once
 * from the DI container (rather than `new`ing throwaway copies), exactly as
 * `ContainerService` resolves its shared runtime/relay singletons. Throws typed
 * {@link ApplicationError}s (no Result channel).
 */
export default class TeamService {
    // Shared singletons — kept cross-module (chat/dashboard/auth/trajectory) and
    // by team event handlers, so resolved once here instead of duplicated.
    #teams = diContainer.resolve<ITeamRepository>(TEAM_TOKENS.TeamRepository);
    #members = diContainer.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository);
    #roles = diContainer.resolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository);
    #membership = diContainer.resolve<ITeamMembershipService>(TEAM_TOKENS.TeamMembershipService);
    #users = { addTeamToUser: (userId: string, teamId: string) => UserModel.findByIdAndUpdate(userId, { $addToSet: { teams: teamId } }) };
    #deploymentSettings = diContainer.resolve<IDeploymentSettingsRepository>(SYSTEM_CONTRACT_TOKENS.DeploymentSettingsRepository);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async create(userId: string, input: CreateTeamInput): Promise<PersistedOutput<TeamProps>> {
        const { name, description } = input;
        const team = await this.#teams.create({ name, description, owner: userId });

        const ownerRoleDefinition = SystemRoles[SystemRoleNames.OWNER];
        const ownerRole = await this.#roles.create(TeamRole.create({
            teamId: team._id,
            name: ownerRoleDefinition.name,
            permissions: ownerRoleDefinition.permissions,
            isSystem: ownerRoleDefinition.isSystem
        }));

        const additionalSystemRoles = [
            SystemRoles[SystemRoleNames.ADMIN],
            SystemRoles[SystemRoleNames.MEMBER],
            SystemRoles[SystemRoleNames.VIEWER]
        ];

        for (const roleDefinition of additionalSystemRoles) {
            await this.#roles.create(TeamRole.create({
                teamId: team._id,
                name: roleDefinition.name,
                permissions: roleDefinition.permissions,
                isSystem: roleDefinition.isSystem
            }));
        }

        await this.#members.create({
            user: userId,
            team: team._id,
            role: ownerRole._id,
            createdAt: new Date(),
            joinedAt: new Date(),
            updatedAt: new Date()
        });

        await this.#users.addTeamToUser(userId, team._id);

        await this.#eventBus.publish(new TeamCreatedEvent({ ownerId: userId, teamId: team._id }));

        return { _id: team._id, ...team.props };
    }

    async listUserTeams(userId: string): Promise<PersistedOutput<TeamProps>[]> {
        return this.#teams.findUserTeams(userId);
    }

    async getById(teamId: string): Promise<PersistedOutput<TeamProps>> {
        const team = await this.#teams.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return toPersistedOutput(team);
    }

    async updateById(teamId: string, data: UpdateTeamInput): Promise<PersistedOutput<TeamProps>> {
        const team = await this.#teams.updateById(teamId, data);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return toPersistedOutput(team);
    }

    async deleteById(teamId: string, userId: string): Promise<void> {
        const deleted = await this.#teams.deleteById(teamId);
        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        await this.#eventBus.publish(new TeamDeletedEvent({ teamId, userId }));
    }

    async setDefaultForNewUsers(teamId: string, enabled: boolean): Promise<{ defaultTeam: string | null; autoJoinNewMembers: boolean }> {
        const settings = await this.#deploymentSettings.setDefaultTeam(enabled ? teamId : null, enabled);
        return {
            defaultTeam: settings.props.defaultTeam,
            autoJoinNewMembers: settings.props.autoJoinNewMembers
        };
    }

    async checkInvitePermission(teamId: string, userId: string): Promise<{ canInvite: boolean }> {
        const member = await this.#members.findOne({ team: teamId, user: userId }, { populate: ['role'] });
        if (!member) {
            return { canInvite: false };
        }
        const permissions = getTeamMemberRolePermissions(member.props.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;
        return { canInvite: permissions.includes('*') || permissions.includes(requiredPermission) };
    }

    async generateInviteCode(teamId: string, userId: string): Promise<PersistedOutput<TeamProps>> {
        await this.#assertCanManageInviteCodes(teamId, userId);

        const team = await this.#teams.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        let code = generateCode();
        let existing = await this.#teams.findByInviteCode(code);
        while (existing) {
            code = generateCode();
            existing = await this.#teams.findByInviteCode(code);
        }

        const updated = await this.#teams.updateById(teamId, { inviteCode: code });
        if (!updated) {
            throw ApplicationError.internalServerError('Failed to update team');
        }
        return toPersistedOutput(updated);
    }

    async deleteInviteCode(teamId: string, userId: string): Promise<{ message: string }> {
        await this.#assertCanManageInviteCodes(teamId, userId);
        await this.#teams.clearInviteCode(teamId);
        return { message: 'Invite code deleted successfully' };
    }

    async getMyPermissions(teamId: string, userId: string): Promise<{ permissions: string[] }> {
        const member = await this.#members.findOne({ team: teamId, user: userId }, { populate: ['role'] });
        if (!member) {
            return { permissions: [] };
        }
        const rolePermissions = this.#resolveRolePermissions(member.props.role);
        return { permissions: Array.from(new Set(rolePermissions)) };
    }

    async leave(teamId: string, userId: string): Promise<void> {
        const team = await this.#teams.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        const member = await this.#members.findOne({ user: userId, team: teamId });
        if (!member) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_USER_NOT_MEMBER, 'You are not a member of this team');
        }
        await this.#membership.removeMemberFromTeam(member._id, teamId);
    }

    async joinByCode(userId: string, code: string): Promise<{ message: string; teamId: string }> {
        const team = await this.#teams.findByInviteCode(normalizeInviteCode(code));
        if (!team) {
            throw this.#invalidInviteCodeError();
        }

        const existing = await this.#members.findOne({ team: team._id, user: userId });
        if (existing) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITE_CODE_ALREADY_MEMBER, 'You are already a member of this team');
        }

        await this.#membership.addMemberToTeam(userId, team._id, SystemRoleNames.OWNER);

        return { message: 'Successfully joined team', teamId: team._id };
    }

    async previewJoinByCode(userId: string, code: string): Promise<{
        message: string;
        teamId: string;
        teamName: string;
        ownerName: string;
        isAlreadyMember: boolean;
    }> {
        const team = await this.#teams.findByInviteCode(normalizeInviteCode(code));
        if (!team) {
            throw this.#invalidInviteCodeError();
        }

        const existingMember = await this.#members.findOne({ team: team._id, user: userId });
        const owner = team.props.owner as string | PopulatedTeamOwner;
        const ownerDetails = typeof owner === 'string' ? null : owner.props;
        const ownerFirstName = ownerDetails?.firstName?.trim() ?? '';
        const ownerLastName = ownerDetails?.lastName?.trim() ?? '';
        const ownerName = `${ownerFirstName} ${ownerLastName}`.trim() || 'Team owner';

        return {
            message: 'Invite preview loaded',
            teamId: team._id,
            teamName: team.props.name,
            ownerName,
            isAlreadyMember: Boolean(existingMember)
        };
    }

    // ---- Internal helpers -------------------------------------------------

    #invalidInviteCodeError(): ApplicationError {
        return ApplicationError.notFound(ErrorCodes.TEAM_INVITE_CODE_NOT_FOUND, 'Invalid invite code');
    }

    async #assertCanManageInviteCodes(teamId: string, userId: string): Promise<void> {
        const member = await this.#members.findOne({ team: teamId, user: userId }, { populate: ['role'] });
        if (!member) {
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, MANAGE_INVITE_CODES_MESSAGE);
        }
        const permissions = getTeamMemberRolePermissions(member.props.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;
        const canManage = permissions.includes('*') || permissions.includes(requiredPermission);
        if (!canManage) {
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, MANAGE_INVITE_CODES_MESSAGE);
        }
    }

    #resolveRolePermissions(memberRole: TeamMemberProps['role']): string[] {
        if (isPopulatedTeamMemberRole(memberRole) && memberRole.isSystem && memberRole.name) {
            switch (memberRole.name) {
                case SystemRoleNames.OWNER:
                    return SystemRoles[SystemRoleNames.OWNER].permissions;
                case SystemRoleNames.ADMIN:
                    return SystemRoles[SystemRoleNames.ADMIN].permissions;
                case SystemRoleNames.MEMBER:
                    return SystemRoles[SystemRoleNames.MEMBER].permissions;
                case SystemRoleNames.VIEWER:
                    return SystemRoles[SystemRoleNames.VIEWER].permissions;
                default:
                    break;
            }
        }
        return getTeamMemberRolePermissions(memberRole);
    }
}
