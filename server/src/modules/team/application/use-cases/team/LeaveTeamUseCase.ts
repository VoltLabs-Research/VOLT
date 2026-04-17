import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamMembershipService from '@modules/team/infrastructure/services/team/TeamMembershipService';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<TeamUserScopedInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamMembershipService)
        private readonly teamMembershipService: TeamMembershipService
    ){}

    async execute(input: TeamUserScopedInputDTO): Promise<Result<null, ApplicationError>> {
        const { teamId, userId } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const member = await this.teamMemberRepository.findOne({ user: userId, team: teamId });
        if (!member) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_USER_NOT_MEMBER,
                'You are not a member of this team'
            ));
        }

        await this.teamMembershipService.removeMemberFromTeam(member._id, teamId);

        return Result.ok(null);
    }
};
