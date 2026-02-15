import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { DeleteContainerOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class DeleteContainerUseCase implements IUseCase<{ containerId: string }, DeleteContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async execute(input: { containerId: string }): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.repository.findById(input.containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        // Remove Docker Container (force: true handles stopping)
        try {
            await this.containerService.removeContainer(container.containerId);
        } catch (e) {
            // Ignore if already gone
        }

        // Remove Network (if owned, see legacy logic)
        if (container.network) {
            // TODO: Direct Mongoose model import violates clean architecture. Refactor to use
            // INetworkRepository once that repository interface is created.
            const { DockerNetwork } = await import('@modules/container/infrastructure/persistence/mongo/models/DockerNetworkModel');
            const netDoc = await DockerNetwork.findById(container.network);
            if (netDoc) {
                await this.containerService.removeNetwork(netDoc.networkId);
            }
        }

        // Remove Volume
        if (container.volume) {
            // TODO: Direct Mongoose model import violates clean architecture. Refactor to use
            // IVolumeRepository once that repository interface is created.
            const { DockerVolume } = await import('@modules/container/infrastructure/persistence/mongo/models/DockerVolumeModel');
            const volDoc = await DockerVolume.findById(container.volume);
            if (volDoc) {
                await this.containerService.removeVolume(volDoc.name);
            }
        }

        await this.repository.deleteById(input.containerId);

        return Result.ok({ message: 'Container deleted successfully' });
    }
}
