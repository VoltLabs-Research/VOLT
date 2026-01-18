import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { GetTeamRoleByIdInputDTO, GetTeamRoleByIdOutputDTO } from '@modules/team/application/dtos/team-role/GetTeamRoleByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class GetTeamRoleByIdUseCase implements IUseCase<GetTeamRoleByIdInputDTO, GetTeamRoleByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ) { }

    async execute(input: GetTeamRoleByIdInputDTO): Promise<Result<GetTeamRoleByIdOutputDTO, ApplicationError>> {
        const teamRole = await this.teamRoleRepository.findById(input.roleId);
        if (!teamRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        return Result.ok(teamRole.props);
    }
};