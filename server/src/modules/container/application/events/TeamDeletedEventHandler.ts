import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import type { Container } from '@modules/container/domain/entities/Container';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Container> {
    constructor(
        
        protected readonly repository: ContainerRepository,

        
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
};
