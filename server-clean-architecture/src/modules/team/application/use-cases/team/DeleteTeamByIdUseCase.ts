import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { DeleteTeamByIdInputDTO } from "../../dtos/team/DeleteTeamByIdDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class DeleteTeamByIdUseCase implements IUseCase<DeleteTeamByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}

    async execute(input: DeleteTeamByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { teamId } = input;
        const team = await this.teamRepository.deleteById(teamId);
        if(!team){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        return Result.ok(null);
    }
};