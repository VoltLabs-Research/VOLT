import { DeleteContainerUseCase } from '@modules/container/use-cases/DeleteContainerUseCase';
import type { Container } from '@modules/container/entities/Container';
import type { IContainerRepository } from '@modules/container/ports/IContainerRepository';
import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Container> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) protected readonly repository: IContainerRepository,
        private readonly deleteContainerUseCase: DeleteContainerUseCase
    ) {
        super();
    }

    protected async deleteOne(containerId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteContainerUseCase.execute({
            containerId,
            teamId: event.payload.teamId,
            userId: event.payload.userId ?? ''
        });
    }
}
