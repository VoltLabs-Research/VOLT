import { DeleteContainerInputDTO, DeleteContainerOutputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerUseCase implements IUseCase<DeleteContainerInputDTO, DeleteContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: DeleteContainerInputDTO): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        await this.containerRuntimeService.removeContainer(teamClusterId, container.containerId);
        await this.repository.deleteById(input.containerId);

        await this.eventBus.publish(new ContainerDeletedEvent({
            containerId: input.containerId,
            teamId: container.team?.toString() ?? ''
        }));

        return Result.ok({ message: 'Container deleted successfully' });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
};
