import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import UserModel from '@modules/auth/models/UserModel';
import TeamModel from '@modules/team/models/team/TeamModel';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoleModel from '@modules/team/models/team-role/TeamRoleModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { container as diContainer } from 'tsyringe';

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    logger.warn(context, `[TeamMembershipService] ${message}`);
};

export default class TeamMembershipService {
    #users = {
        addTeamToUser: (userId: string, teamId: string) => UserModel.findByIdAndUpdate(userId, { $addToSet: { teams: teamId } }),
        removeTeamFromUser: (userId: string, teamId: string) => UserModel.findByIdAndUpdate(userId, { $pull: { teams: teamId } })
    };
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async addMemberToTeam(userId: string, teamId: string, roleName: string = SystemRoleNames.MEMBER): Promise<void> {
        const existing = await TeamMemberModel.findOne({ team: teamId, user: userId });
        if (existing) return;
        const role = await TeamRoleModel.findOne({ name: roleName, team: teamId });
        if (!role) throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Role not found');
        await TeamMemberModel.create({ team: teamId, user: userId, role: role._id, joinedAt: new Date() });
        await this.#users.addTeamToUser(userId, teamId);
    }

    async removeMemberFromTeam(memberId: string, teamId: string): Promise<void> {
        const membership = await TeamMemberModel.findById(memberId);
        const membershipUserId = membership ? String(membership.user) : undefined;

        await TeamMemberModel.findByIdAndDelete(memberId);
        if (membershipUserId) {
            await this.#users.removeTeamFromUser(membershipUserId, teamId);
        }

        const membersCount = await TeamMemberModel.countDocuments({ team: teamId });
        const team = await TeamModel.findById(teamId);
        if (!team) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        if (membersCount === 0) {
            await TeamModel.findByIdAndDelete(team._id);
            await this.#eventBus.publish(new TeamDeletedEvent({ teamId }));
            return;
        }

        const ownerRole = await TeamRoleModel.findOne({
            team: team._id,
            name: 'Owner',
            isSystem: true
        });

        if (!ownerRole) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_ROLE_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        const ownersCount = await TeamMemberModel.countDocuments({ role: ownerRole._id });
        if (ownersCount !== 0) {
            return;
        }

        const randomMember = await TeamMemberModel.findOne({ team: teamId });
        if (!randomMember) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_MEMBER_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        await TeamMemberModel.findByIdAndUpdate(randomMember._id, { role: ownerRole._id });
    }
}
