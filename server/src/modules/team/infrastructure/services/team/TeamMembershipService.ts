import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    console.warn('[TeamMembershipService]', message, context);
};

@Singleton(TEAM_TOKENS.TeamMembershipService)
export default class TeamMembershipService implements ITeamMembershipService {
    constructor(
        
        private readonly teamRoleRepository: TeamRoleRepository,

        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository,

        private readonly userRepository: UserRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async addMemberToTeam(userId: string, teamId: string, roleName: string = SystemRoleNames.MEMBER): Promise<void> {
        const existing = await this.teamMemberRepository.findOne({ team: teamId, user: userId });
        if (existing) return;
        const role = await this.teamRoleRepository.findOne({ name: roleName, team: teamId });
        if (!role) throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Role not found');
        const member = await this.teamMemberRepository.create({ team: teamId, user: userId, role: role._id, joinedAt: new Date() });
        await this.teamRepository.addMemberToTeam(member._id, teamId);
        await this.userRepository.addTeamToUser(userId, teamId);
    }

    async removeMemberFromTeam(memberId: string, teamId: string): Promise<void> {
        const membership = await this.teamMemberRepository.findById(memberId);
        const membershipUserId = typeof membership?.props.user === 'string'
            ? membership.props.user
            : membership?.props.user?._id;

        await this.teamRepository.removeUserFromTeam(memberId, teamId);
        await this.teamMemberRepository.deleteById(memberId);
        if (membershipUserId) {
            await this.userRepository.removeTeamFromUser(membershipUserId, teamId);
        }

        const membersCount = await this.teamMemberRepository.count({ team: teamId });
        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        if (membersCount === 0) {
            await this.teamRepository.deleteById(team._id);
            await this.eventBus.publish(new TeamDeletedEvent({ teamId }));
            return;
        }

        const ownerRole = await this.teamRoleRepository.findOne({
            team: team._id,
            name: 'Owner',
            isSystem: true
        });

        if (!ownerRole) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_ROLE_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        const ownersCount = await this.teamMemberRepository.count({ role: ownerRole._id });
        if (ownersCount !== 0) {
            return;
        }

        const randomMember = await this.teamMemberRepository.findOne({ team: teamId });
        if (!randomMember) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_MEMBER_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        await this.teamMemberRepository.updateById(randomMember._id, { role: ownerRole._id });
    }
};
