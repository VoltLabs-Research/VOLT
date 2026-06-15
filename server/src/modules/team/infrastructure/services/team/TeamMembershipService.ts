import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    logger.warn(context, `[TeamMembershipService] ${message}`);
};

@Singleton(TEAM_TOKENS.TeamMembershipService)
export default class TeamMembershipService implements ITeamMembershipService {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(AUTH_CONTRACT_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async addMemberToTeam(userId: string, teamId: string, roleName: string = SystemRoleNames.MEMBER): Promise<void> {
        const existing = await this.teamMemberRepository.findOne({ team: teamId, user: userId });
        if (existing) return;
        const role = await this.teamRoleRepository.findOne({ name: roleName, team: teamId });
        if (!role) throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Role not found');
        await this.teamMemberRepository.create({ team: teamId, user: userId, role: role._id, joinedAt: new Date() });
        await this.userRepository.addTeamToUser(userId, teamId);
    }

    async removeMemberFromTeam(memberId: string, teamId: string): Promise<void> {
        const membership = await this.teamMemberRepository.findById(memberId);
        const membershipUserId = typeof membership?.props.user === 'string'
            ? membership.props.user
            : membership?.props.user?._id;

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
