import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type { Container } from '@modules/container/domain/entities/Container';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';

@injectable()
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Container> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        protected readonly repository: IContainerRepository,

        @inject(DeleteContainerUseCase)
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
