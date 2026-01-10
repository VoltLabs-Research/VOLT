import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { DeleteTeamMemberByIdInputDTO } from "../../dtos/team-member/DeleteTeamMemberByIdDTO";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";

@injectable()
export default class DeleteTeamMemberByIdUseCase implements IUseCase<DeleteTeamMemberByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(input: DeleteTeamMemberByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { teamMemberId } = input;
        const teamMember = await this.teamMemberRepository.deleteById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        return Result.ok(null);
    }
};