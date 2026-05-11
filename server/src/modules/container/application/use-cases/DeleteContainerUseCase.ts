import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteContainerInputDTO, DeleteContainerOutputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import { ContainerPortProxyRelayService } from '@modules/container/infrastructure/services/ContainerPortProxyRelayService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteContainerUseCase implements IUseCase<DeleteContainerInputDTO, DeleteContainerOutputDTO> {
    constructor(
        private repository: ContainerRepository,
        private containerRuntimeService: DaemonContainerRuntimeService,
        private readonly relayService: ContainerPortProxyRelayService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: DeleteContainerInputDTO): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);
        const userId = this.requireUserId(input.userId);

        await this.containerRuntimeService.removeContainer(teamClusterId, container.containerId);
        await this.repository.deleteById(input.containerId);
        await this.relayService.stopContainerRelays(container._id);

        await this.eventBus.publish(new ContainerDeletedEvent({
            containerId: input.containerId,
            teamId: container.team?.toString() ?? '',
            userId,
            containerName: container.name ?? ''
        }));

        return Result.ok({ message: 'Container deleted successfully' });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }

    private requireUserId(userId?: string): string {
        if (!userId?.trim()) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Actor userId is required'
            );
        }

        return userId;
    }
}
