import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { DeleteTeamByIdInputDTO } from '@modules/team/application/dtos/team/DeleteTeamByIdDTO';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class DeleteTeamByIdUseCase implements IUseCase<DeleteTeamByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { teamId } = input;
        const deleted = await this.teamRepository.deleteById(teamId);
        if(!deleted){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        await this.eventBus.publish(new TeamDeletedEvent({
            teamId
        }));

        return Result.ok(null);
    }
};
