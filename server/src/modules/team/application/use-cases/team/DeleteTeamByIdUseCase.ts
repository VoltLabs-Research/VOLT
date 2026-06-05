import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteTeamByIdInputDTO } from '@modules/team/application/dtos/team/DeleteTeamByIdDTO';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamByIdUseCase implements IUseCase<DeleteTeamByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { teamId, userId } = input;
        const deleted = await this.teamRepository.deleteById(teamId);
        if(!deleted){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        await this.eventBus.publish(new TeamDeletedEvent({
            teamId,
            userId
        }));

        return Result.ok(null);
    }
}
