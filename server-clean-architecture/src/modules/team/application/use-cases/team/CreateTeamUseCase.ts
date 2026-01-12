import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { CreateTeamInputDTO, CreateTeamOutputDTO } from "../../dtos/team/CreateTeamDTO";

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute(input: CreateTeamInputDTO): Promise<Result<CreateTeamOutputDTO, ApplicationError>> {
        const { name, description, ownerId } = input;
        const team = await this.teamRepository.create({
            name,
            description,
            owner: ownerId,
            members: [ownerId]
        });

        return Result.ok(team.props);
    }
}