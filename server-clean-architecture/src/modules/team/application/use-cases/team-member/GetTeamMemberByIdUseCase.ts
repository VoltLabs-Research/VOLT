import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import TeamMemberRepository from "../../../infrastructure/persistence/mongo/repositories/TeamMemberRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { GetTeamMemberByIdInputDTO, GetTeamMemberByIdOutputDTO } from "../../dtos/team-member/GetTeamMemberByIdDTO";

@injectable()
export default class GetTeamMemberByIdUseCase implements IUseCase<GetTeamMemberByIdInputDTO, GetTeamMemberByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: TeamMemberRepository
    ){}

    async execute(input: GetTeamMemberByIdInputDTO): Promise<Result<GetTeamMemberByIdOutputDTO, ApplicationError>>{
        const { teamMemberId } = input;
        const teamMember = await this.teamMemberRepository.findById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        return Result.ok(teamMember.props);
    }
};