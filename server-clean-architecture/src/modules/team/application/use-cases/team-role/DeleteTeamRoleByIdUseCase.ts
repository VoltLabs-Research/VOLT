import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO } from "../../dtos/team-role/DeleteTeamRoleByIdDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class DeleteTeamRoleByIdUseCase implements IUseCase<DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(input: DeleteTeamRoleByIdInputDTO): Promise<Result<DeleteTeamRoleByIdOutputDTO, ApplicationError>>{
        const result = await this.teamRoleRepository.deleteById(input.roleId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }
        return Result.ok({ success: true });
    }
};