import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { AUTH_TOKENS } from '@/src/modules/auth/infrastructure/di/AuthTokens';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { ITeamMemberRepository } from '../../../domain/ports/ITeamMemberRepository';
import { IUserRepository } from '@/src/modules/auth/domain/ports/IUserRepository';
import { LeaveTeamInputDTO, LeaveTeamOutputDTO } from '../../dtos/team/LeaveTeamDTO';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<LeaveTeamInputDTO, LeaveTeamOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) {}

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
                'Team owner cannot leave. Delete the team instead.'
            ));
        }

        await Promise.all([
            this.teamMemberRepository.deleteMany({ team: teamId, user: userId }),
            this.teamRepository.removeUserFromTeam(userId, teamId),
            this.userRepository.removeTeamFromUser(userId, teamId)
        ]);

        return Result.ok({ success: true });
    }
}
