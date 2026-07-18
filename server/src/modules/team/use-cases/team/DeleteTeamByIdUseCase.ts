import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteTeamByIdInputDTO } from '@modules/team/dtos/team/DeleteTeamByIdDTO';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamByIdUseCase implements IUseCase<DeleteTeamByIdInputDTO, null>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamByIdInputDTO): Promise<null> {
        const { teamId, userId } = input;
        const deleted = await this.teamRepository.deleteById(teamId);
        if(!deleted){
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }

        await this.eventBus.publish(new TeamDeletedEvent({
            teamId,
            userId
        }));

        return null;
    }
}
