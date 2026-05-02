import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import TeamMembershipService from '@modules/team/infrastructure/services/team/TeamMembershipService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<TeamUserScopedInputDTO, null, ApplicationError> {
    constructor(
        private readonly teamRepository: TeamRepository,
        private readonly teamMemberRepository: TeamMemberRepository,
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
}
