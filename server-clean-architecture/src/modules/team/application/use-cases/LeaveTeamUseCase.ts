import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';

export interface LeaveTeamInputDTO {
    teamId: string;
    userId: string;
}

export interface LeaveTeamOutputDTO {
    message: string;
}

@injectable()
export default class LeaveTeamUseCase implements IUseCase<LeaveTeamInputDTO, LeaveTeamOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ) { }

    async execute(input: LeaveTeamInputDTO): Promise<Result<LeaveTeamOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        if (team.isOwner(userId)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_OWNER_CANNOT_LEAVE,
                'Team owner cannot leave the team. Transfer ownership or delete the team instead.'
            ));
        }

        const isMember = await this.teamRepository.hasAccess(userId, teamId);
        if (!isMember) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_USER_NOT_MEMBER,
                'You are not a member of this team'
            ));
        }

        await this.teamRepository.removeUserFromTeam(userId, teamId);

        return Result.ok({
            message: 'You have left the team successfully'
        });
    }
}
