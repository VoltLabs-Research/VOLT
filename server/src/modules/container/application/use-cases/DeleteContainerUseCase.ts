import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { DeleteContainerOutputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';

@injectable()
export class DeleteContainerUseCase implements IUseCase<{ containerId: string }, DeleteContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService,
        @inject('IDockerNetworkRepository') private networkRepository: IDockerNetworkRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: { containerId: string }): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.repository.findById(input.containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        // Stop and Remove Docker Container
        try {
            await this.containerService.stopContainer(container.containerId);
            await this.containerService.removeContainer(container.containerId);
        } catch {
            // Ignore if already gone
        }

        // Remove Network (if owned)
        if (container.network) {
            const networkDocument = await this.networkRepository.findById(container.network);
            if (networkDocument) {
                await this.containerService.removeNetwork(networkDocument.networkId);
            }
        }

        await this.repository.deleteById(input.containerId);

        await this.eventBus.publish(new ContainerDeletedEvent({
            containerId: input.containerId,
            teamId: container.team?.toString() ?? ''
        }));

        return Result.ok({ message: 'Container deleted successfully' });
    }
}
