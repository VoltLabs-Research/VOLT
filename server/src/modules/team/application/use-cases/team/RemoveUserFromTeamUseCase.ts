import { ErrorCodes } from '@core/constants/error-codes';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { RemoveUserFromTeamInputDTO } from '@modules/team/application/dtos/team/RemoveUserFromTeamDTO';
import TeamMembershipService from '@modules/team/infrastructure/services/team/TeamMembershipService';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class RemoveUserFromTeamUseCase implements IUseCase<RemoveUserFromTeamInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,

        @inject(AUTH_TOKENS.UserRepository)
        private userRepository: IUserRepository,

        @inject(TEAM_TOKENS.TeamMembershipService)
        private teamMembershipService: TeamMembershipService
    ){}

    async execute(input: RemoveUserFromTeamInputDTO): Promise<Result<null, ApplicationError>>{
        const { teamId, toRemoveUserId } = input;

        const [userToRemove, team] = await Promise.all([
            this.userRepository.findById(toRemoveUserId),
            this.teamRepository.findById(teamId)
        ]);

        if(!userToRemove){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }

        if(!team){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const member = await this.teamMemberRepository.findOne({ team: teamId, user: toRemoveUserId });
        if(!member){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        await this.teamMembershipService.removeMemberFromTeam(member._id, teamId);

        return Result.ok(null);
    }
};
