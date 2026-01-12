import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { RemoveUserFromTeamInputDTO } from "../../dtos/team/RemoveUserFromTeamDTO";
import { AUTH_TOKENS } from "@/src/modules/auth/infrastructure/di/AuthTokens";
import { IUserRepository } from "@/src/modules/auth/domain/ports/IUserRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";

// TODO: REFACTOR 
@injectable()
export default class RemoveUserFromTeamUseCase implements IUseCase<RemoveUserFromTeamInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,
        @inject(AUTH_TOKENS.UserRepository)
        private userRepository: IUserRepository
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

        if(team.isOwner(toRemoveUserId)){
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_CANNOT_REMOVE_OWNER,
                'Cannot remove team owner'
            ));
        }

        const member = await this.teamMemberRepository.findOne({ team: teamId, user: toRemoveUserId });
        if(!member){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }
        
        await Promise.all([
            // $pull from members and admins
            this.teamRepository.removeUserFromTeam(toRemoveUserId, teamId),
            this.teamMemberRepository.deleteById(member.id),
            this.userRepository.removeTeamFromUser(toRemoveUserId, teamId) 
        ]);

        return Result.ok(null);
    }
};