import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTeamByIdInputDTO, UpdateTeamByIdOutputDTO } from '@modules/team/application/dtos/team/UpdateTeamByIdDTO';

@injectable()
export default class UpdateTeamByIdUseCase implements IUseCase<UpdateTeamByIdInputDTO, UpdateTeamByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}

    async execute(input: UpdateTeamByIdInputDTO): Promise<Result<UpdateTeamByIdOutputDTO, ApplicationError>> {
        const { name, description, teamId } = input;
        const team = await this.teamRepository.updateById(teamId, { name, description }, {
            populate: ['owner']
        });
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        return Result.ok(team.props);
    }
};