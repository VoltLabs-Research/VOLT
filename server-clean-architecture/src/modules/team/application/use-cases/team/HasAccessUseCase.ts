import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { HasAccessInputDTO } from "../../dtos/team/HasAccessDTO";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";

@injectable()
export default class HasAccessUseCase implements IUseCase<HasAccessInputDTO, boolean, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute(input: HasAccessInputDTO): Promise<Result<boolean, ApplicationError>>{
        const { userId, teamId } = input;
        const result = await this.teamRepository.hasAccess(userId, teamId);
        return Result.ok(result);
    }
}