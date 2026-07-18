import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<TeamUserScopedInputDTO, null> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamMembershipService) private readonly teamMembershipService: ITeamMembershipService
    ){}

    async execute(input: TeamUserScopedInputDTO): Promise<null> {
        const { teamId, userId } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }

        const member = await this.teamMemberRepository.findOne({ user: userId, team: teamId });
        if (!member) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_USER_NOT_MEMBER,
                'You are not a member of this team'
            );
        }

        await this.teamMembershipService.removeMemberFromTeam(member._id, teamId);

        return null;
    }
}
