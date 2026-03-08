import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { DeleteContainerInputDTO, DeleteContainerOutputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { IDockerVolumeRepository } from '@modules/container/domain/port/IDockerVolumeRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';
import { ContainerOwnershipService } from '@modules/container/application/services/ContainerOwnershipService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';

@injectable()
export class DeleteContainerUseCase implements IUseCase<DeleteContainerInputDTO, DeleteContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(CONTAINER_TOKENS.DockerNetworkRepository) private networkRepository: IDockerNetworkRepository,
        @inject(CONTAINER_TOKENS.DockerVolumeRepository) private volumeRepository: IDockerVolumeRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ){}

    async execute(input: DeleteContainerInputDTO): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        await this.containerService.stopContainer(container.containerId);
        await this.containerService.removeContainer(container.containerId);
        await this.repository.deleteById(input.containerId);

        if (container.network) {
            const networkDocument = await this.networkRepository.findById(container.network);
            if (networkDocument) {
                await this.containerService.removeNetwork(networkDocument.networkId);
                await this.networkRepository.deleteById(container.network);
            }
        }

        if (container.volume) {
            const volumeDocument = await this.volumeRepository.findById(container.volume);
            if (volumeDocument) {
                await this.containerService.removeVolume(volumeDocument.volumeId);
                await this.volumeRepository.deleteById(container.volume);
            }
        }

        await this.eventBus.publish(new ContainerDeletedEvent({
            containerId: input.containerId,
            teamId: container.team?.toString() ?? ''
        }));

        return Result.ok({ message: 'Container deleted successfully' });
    }
}
