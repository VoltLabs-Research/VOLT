import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import { addTeamToUser } from '@modules/team/services/team/user-team-links';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';
import { In } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type {
    CreateTeamInput,
    UpdateTeamInput
} from '@volt/contracts/modules/team/http';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_LENGTH = 5;
const MANAGE_INVITE_CODES_MESSAGE = 'You do not have permission to manage invite codes';
const MANAGE_INVITE_CODES_PERMISSION = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;

const generateCode = (): string => {
    let code = '';
    for(let i = 0; i < INVITE_CODE_LENGTH; i++){
        code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
    }
    return code;
};

const normalizeInviteCode = (code: string): string => code.trim().toUpperCase();

export default class TeamService{
    #membership = new TeamMembershipService();
    #deploymentSettings = new DeploymentSettingsService();

    async create(userId: string, input: CreateTeamInput): Promise<Team>{
        const { name, description } = input;

        const team = await Team.getRepository().manager.transaction(async (manager): Promise<Team> => {
            const createdTeam = await manager.save(manager.create(Team, {
                name,
                description,
                owner: userId
            }));

            const roleIdsByName = new Map<string, string>();
            for(const definition of Object.values(SystemRoles)){
                const role = await manager.save(manager.create(TeamRole, {
                    team: createdTeam.id,
                    name: definition.name,
                    permissions: definition.permissions,
                    isSystem: definition.isSystem
                }));
                roleIdsByName.set(definition.name, role.id);
            }

            await manager.save(manager.create(TeamMember, {
                user: userId,
                team: createdTeam.id,
                role: roleIdsByName.get(SystemRoleNames.OWNER),
                joinedAt: new Date()
            }));

            await addTeamToUser(userId, createdTeam.id, manager);

            return createdTeam;
        });

        await eventBus.emit('team.created', {
            ownerId: userId,
            teamId: team.id
        });

        return team;
    }

    async listUserTeams(userId: string): Promise<Team[]>{
        const memberships = await TeamMember.findBy({ user: userId });
        const memberTeamIds = [...new Set(memberships.map((membership) => membership.team))];

        const where: FindOptionsWhere<Team>[] = memberTeamIds.length === 0
            ? [{ owner: userId }]
            : [
                { id: In(memberTeamIds) },
                { owner: userId }
            ];

        return Team.find({
            where,
            relations: { ownerRef: true }
        });
    }

    async getById(teamId: string): Promise<Team>{
        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return team;
    }

    async updateById(teamId: string, data: UpdateTeamInput): Promise<Team>{
        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        return Object.assign(team, data).save();
    }

    async deleteById(teamId: string, userId: string): Promise<void>{
        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        await team.remove();
        await eventBus.emit('team.deleted', {
            teamId,
            userId
        });
    }

    async setDefaultForNewUsers(teamId: string, enabled: boolean): Promise<{ defaultTeam: string | null; autoJoinNewMembers: boolean }>{
        const settings = await this.#deploymentSettings.setDefaultTeam(enabled ? teamId : null, enabled);
        return {
            defaultTeam: settings.props.defaultTeam,
            autoJoinNewMembers: settings.props.autoJoinNewMembers
        };
    }

    async checkInvitePermission(teamId: string, userId: string): Promise<{ canInvite: boolean }>{
        return { canInvite: await this.#canManageInviteCodes(teamId, userId) };
    }

    async generateInviteCode(teamId: string, userId: string): Promise<Team>{
        await this.#assertCanManageInviteCodes(teamId, userId);

        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        let code = generateCode();
        let existing = await Team.findOneBy({ inviteCode: code });
        while(existing){
            code = generateCode();
            existing = await Team.findOneBy({ inviteCode: code });
        }

        return Object.assign(team, { inviteCode: code }).save();
    }

    async deleteInviteCode(teamId: string, userId: string): Promise<{ message: string }>{
        await this.#assertCanManageInviteCodes(teamId, userId);
        const team = await Team.findOneBy({ id: teamId });
        if(team){
            await Object.assign(team, { inviteCode: null }).save();
        }
        return { message: 'Invite code deleted successfully' };
    }

    async getMyPermissions(teamId: string, userId: string): Promise<{ permissions: string[] }>{
        const member = await TeamMember.findOne({
            where: {
                team: teamId,
                user: userId
            },
            relations: { roleRef: true }
        });
        const role = member?.roleRef;
        const systemPermissions = role?.isSystem ? SystemRoles[role.name]?.permissions : undefined;

        return { permissions: Array.from(new Set(systemPermissions ?? role?.permissions ?? [])) };
    }

    async leave(teamId: string, userId: string): Promise<void>{
        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }
        const member = await TeamMember.findOneBy({
            user: userId,
            team: teamId
        });
        if(!member){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_USER_NOT_MEMBER, 'You are not a member of this team');
        }
        await this.#membership.removeMemberFromTeam(member.id, teamId);
    }

    async joinByCode(userId: string, code: string): Promise<{ message: string; teamId: string }>{
        const team = await Team.findOneBy({ inviteCode: normalizeInviteCode(code) });
        if(!team){
            throw this.#invalidInviteCodeError();
        }

        const existing = await TeamMember.findOneBy({
            team: team.id,
            user: userId
        });
        if(existing){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITE_CODE_ALREADY_MEMBER, 'You are already a member of this team');
        }

        await this.#membership.addMemberToTeam(userId, team.id, SystemRoleNames.OWNER);

        return {
            message: 'Successfully joined team',
            teamId: team.id
        };
    }

    async previewJoinByCode(userId: string, code: string): Promise<{
        message: string;
        teamId: string;
        teamName: string;
        ownerName: string;
        isAlreadyMember: boolean;
    }>{
        const team = await Team.findOne({
            where: { inviteCode: normalizeInviteCode(code) },
            relations: { ownerRef: true }
        });
        if(!team){
            throw this.#invalidInviteCodeError();
        }

        const existingMember = await TeamMember.findOneBy({
            team: team.id,
            user: userId
        });
        const ownerFirstName = team.ownerRef?.firstName?.trim() ?? '';
        const ownerLastName = team.ownerRef?.lastName?.trim() ?? '';
        const ownerName = `${ownerFirstName} ${ownerLastName}`.trim() || 'Team owner';

        return {
            message: 'Invite preview loaded',
            teamId: team.id,
            teamName: team.name,
            ownerName,
            isAlreadyMember: Boolean(existingMember)
        };
    }

    #invalidInviteCodeError(): ApplicationError{
        return ApplicationError.notFound(ErrorCodes.TEAM_INVITE_CODE_NOT_FOUND, 'Invalid invite code');
    }

    async #canManageInviteCodes(teamId: string, userId: string): Promise<boolean>{
        const member = await TeamMember.findOne({
            where: {
                team: teamId,
                user: userId
            },
            relations: { roleRef: true }
        });
        const permissions = member?.roleRef?.permissions ?? [];

        return permissions.includes('*') || permissions.includes(MANAGE_INVITE_CODES_PERMISSION);
    }

    async #assertCanManageInviteCodes(teamId: string, userId: string): Promise<void>{
        if(!await this.#canManageInviteCodes(teamId, userId)){
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, MANAGE_INVITE_CODES_MESSAGE);
        }
    }
}
