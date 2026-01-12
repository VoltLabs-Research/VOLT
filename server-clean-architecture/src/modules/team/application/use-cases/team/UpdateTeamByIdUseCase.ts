import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { UpdateTeamByIdInputDTO, UpdateTeamByIdOutputDTO } from "../../dtos/team/UpdateTeamByIdDTO";

@injectable()
export default class UpdateTeamByIdUseCase implements IUseCase<UpdateTeamByIdInputDTO, UpdateTeamByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}

    async execute(input: UpdateTeamByIdInputDTO): Promise<Result<UpdateTeamByIdOutputDTO, ApplicationError>>{
        const { name, description, teamId } = input;
        const team = await this.teamRepository.updateById(teamId, { name, description });
        if(!team){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        return Result.ok(team.props);
    }
};