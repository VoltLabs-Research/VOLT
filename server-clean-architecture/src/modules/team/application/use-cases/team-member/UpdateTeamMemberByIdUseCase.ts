import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { UpdateTeamMemberByIdInputDTO, UpdateTeamMemberByIdOutputDTO } from "../../dtos/team-member/UpdateTeamMemberByIdDTO";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";

@injectable()
export default class UpdateTeamMemberByIdUseCase implements IUseCase<UpdateTeamMemberByIdInputDTO, UpdateTeamMemberByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(input: UpdateTeamMemberByIdInputDTO): Promise<Result<UpdateTeamMemberByIdOutputDTO, ApplicationError>>{
        const { teamMemberId, roleId } = input;
        const teamMember = await this.teamMemberRepository.updateById(teamMemberId, { role: roleId });
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        return Result.ok(teamMember.props);
    }
}