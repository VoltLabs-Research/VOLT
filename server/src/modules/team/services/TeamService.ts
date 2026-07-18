import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import UserModel from '@modules/auth/models/UserModel';
import TeamModel from '@modules/team/models/team/TeamModel';
import type { TeamProps } from '@modules/team/models/team/TeamModel';
import TeamMemberModel, {
    getTeamMemberRolePermissions,
    isPopulatedTeamMemberRole
} from '@modules/team/models/team-member/TeamMemberModel';
import type { TeamMemberProps } from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoleModel, { buildTeamRoleCreatePayload } from '@modules/team/models/team-role/TeamRoleModel';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import { toPersistedOutput } from '@modules/team/utilities/toPersistedOutput';
import TeamCreatedEvent from '@modules/team/events/team/TeamCreatedEvent';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import DeploymentSettingsRepository from '@modules/system/repositories/DeploymentSettingsRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
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
    firstName?: string;
    lastName?: string;
}

export default class TeamService {
    #membership = new TeamMembershipService();
    #users = { addTeamToUser: (userId: string, teamId: string) => UserModel.findByIdAndUpdate(userId, { $addToSet: { teams: teamId } }) };
    #deploymentSettings = new DeploymentSettingsRepository();
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async create(userId: string, input: CreateTeamInput): Promise<PersistedOutput<TeamProps>> {
        const { name, description } = input;
        const team = await TeamModel.create({ name, description, owner: userId });

        const ownerRoleDefinition = SystemRoles[SystemRoleNames.OWNER];
        const ownerRole = await TeamRoleModel.create(buildTeamRoleCreatePayload({
            teamId: String(team._id),
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
            await TeamRoleModel.create(buildTeamRoleCreatePayload({
                teamId: String(team._id),
                name: roleDefinition.name,
                permissions: roleDefinition.permissions,
                isSystem: roleDefinition.isSystem
            }));
        }

        await TeamMemberModel.create({
            user: userId,
            team: team._id,
            role: ownerRole._id,
            createdAt: new Date(),
            joinedAt: new Date(),
            updatedAt: new Date()
        });

        await this.#users.addTeamToUser(userId, String(team._id));

        await this.#eventBus.publish(new TeamCreatedEvent({ ownerId: userId, teamId: String(team._id) }));

        return toPersistedOutput<TeamProps>(team);
    }

    async listUserTeams(userId: string): Promise<PersistedOutput<TeamProps>[]> {
        const memberTeamIds = await TeamMemberModel.find({ user: userId }).distinct('team');

        const docs = await TeamModel.find({
            $or: [
                { _id: { $in: memberTeamIds } },
                { owner: userId }
            ]
        }).populate('owner');

        return docs.map((doc) => toPersistedOutput<TeamProps>(doc, ['owner']));
    }

    async getById(teamId: string): Promise<PersistedOutput<TeamProps>> {
        const team = await TeamModel.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return toPersistedOutput<TeamProps>(team);
    }

    async updateById(teamId: string, data: UpdateTeamInput): Promise<PersistedOutput<TeamProps>> {
        const team = await TeamModel.findByIdAndUpdate(teamId, { $set: data }, { new: true });
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return toPersistedOutput<TeamProps>(team);
    }

    async deleteById(teamId: string, userId: string): Promise<void> {
        const deleted = await TeamModel.findByIdAndDelete(teamId);
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
        const member = await TeamMemberModel.findOne({ team: teamId, user: userId }).populate('role');
        if (!member) {
            return { canInvite: false };
        }
        const permissions = getTeamMemberRolePermissions(member.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;
        return { canInvite: permissions.includes('*') || permissions.includes(requiredPermission) };
    }

    async generateInviteCode(teamId: string, userId: string): Promise<PersistedOutput<TeamProps>> {
        await this.#assertCanManageInviteCodes(teamId, userId);

        const team = await TeamModel.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        let code = generateCode();
        let existing = await TeamModel.findOne({ inviteCode: code });
        while (existing) {
            code = generateCode();
            existing = await TeamModel.findOne({ inviteCode: code });
        }

        const updated = await TeamModel.findByIdAndUpdate(teamId, { inviteCode: code }, { new: true });
        if (!updated) {
            throw ApplicationError.internalServerError('Failed to update team');
        }
        return toPersistedOutput<TeamProps>(updated);
    }

    async deleteInviteCode(teamId: string, userId: string): Promise<{ message: string }> {
        await this.#assertCanManageInviteCodes(teamId, userId);
        await TeamModel.findByIdAndUpdate(teamId, { $unset: { inviteCode: '' } });
        return { message: 'Invite code deleted successfully' };
    }

    async getMyPermissions(teamId: string, userId: string): Promise<{ permissions: string[] }> {
        const member = await TeamMemberModel.findOne({ team: teamId, user: userId }).populate('role');
        if (!member) {
            return { permissions: [] };
        }
        const rolePermissions = this.#resolveRolePermissions(member.role);
        return { permissions: Array.from(new Set(rolePermissions)) };
    }

    async leave(teamId: string, userId: string): Promise<void> {
        const team = await TeamModel.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        const member = await TeamMemberModel.findOne({ user: userId, team: teamId });
        if (!member) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_USER_NOT_MEMBER, 'You are not a member of this team');
        }
        await this.#membership.removeMemberFromTeam(String(member._id), teamId);
    }

    async joinByCode(userId: string, code: string): Promise<{ message: string; teamId: string }> {
        const team = await TeamModel.findOne({ inviteCode: normalizeInviteCode(code) });
        if (!team) {
            throw this.#invalidInviteCodeError();
        }

        const existing = await TeamMemberModel.findOne({ team: team._id, user: userId });
        if (existing) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITE_CODE_ALREADY_MEMBER, 'You are already a member of this team');
        }

        await this.#membership.addMemberToTeam(userId, String(team._id), SystemRoleNames.OWNER);

        return { message: 'Successfully joined team', teamId: String(team._id) };
    }

    async previewJoinByCode(userId: string, code: string): Promise<{
        message: string;
        teamId: string;
        teamName: string;
        ownerName: string;
        isAlreadyMember: boolean;
    }> {
        const team = await TeamModel.findOne({ inviteCode: normalizeInviteCode(code) }).populate('owner');
        if (!team) {
            throw this.#invalidInviteCodeError();
        }

        const existingMember = await TeamMemberModel.findOne({ team: team._id, user: userId });
        const owner = team.owner as unknown as string | (PopulatedTeamOwner & { _id?: unknown });
        const ownerDetails = typeof owner === 'string' ? null : owner;
        const ownerFirstName = ownerDetails?.firstName?.trim() ?? '';
        const ownerLastName = ownerDetails?.lastName?.trim() ?? '';
        const ownerName = `${ownerFirstName} ${ownerLastName}`.trim() || 'Team owner';

        return {
            message: 'Invite preview loaded',
            teamId: String(team._id),
            teamName: team.name,
            ownerName,
            isAlreadyMember: Boolean(existingMember)
        };
    }

    #invalidInviteCodeError(): ApplicationError {
        return ApplicationError.notFound(ErrorCodes.TEAM_INVITE_CODE_NOT_FOUND, 'Invalid invite code');
    }

    async #assertCanManageInviteCodes(teamId: string, userId: string): Promise<void> {
        const member = await TeamMemberModel.findOne({ team: teamId, user: userId }).populate('role');
        if (!member) {
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, MANAGE_INVITE_CODES_MESSAGE);
        }
        const permissions = getTeamMemberRolePermissions(member.role);
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
