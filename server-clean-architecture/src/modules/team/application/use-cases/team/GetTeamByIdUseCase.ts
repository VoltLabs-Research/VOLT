import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { GetTeamByIdInputDTO, GetTeamByIdOutputDTO } from "../../dtos/team/GetTeamByIdDTO";

@injectable()
export default class GetTeamByIdUseCase implements IUseCase<GetTeamByIdInputDTO, GetTeamByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}

    async execute(input: GetTeamByIdInputDTO): Promise<Result<GetTeamByIdOutputDTO, ApplicationError>>{
        const { teamId } = input;
        const team = await this.teamRepository.findById(teamId);
        if(!team){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        return Result.ok(team.props);
    }
}