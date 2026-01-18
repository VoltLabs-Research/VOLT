import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<Result<CreateTeamRoleOutputDTO, ApplicationError>>{
        const { teamId, name, permissions, isSystem } = input;

        if (!teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team ID is required'
            ));
        }

        if (!name) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ROLE_NAME_REQUIRED,
                'Role name is required'
            ));
        }

        const newRole = await this.teamRoleRepository.create({
            team: teamId,
            name,
            permissions: permissions || [],
            isSystem,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok(newRole.props);
    }
};