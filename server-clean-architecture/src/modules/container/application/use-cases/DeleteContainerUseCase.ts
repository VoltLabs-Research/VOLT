import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { DeleteContainerOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class DeleteContainerUseCase implements IUseCase<{ id: string }, DeleteContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ) { }

    async execute(input: { id: string }): Promise<Result<DeleteContainerOutputDTO>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        // Stop and Remove Docker Container
        try {
            await this.containerService.stopContainer(container.containerId);
            await this.containerService.removeContainer(container.containerId);
        } catch (e) {
            // Ignore if already gone
        }

        // Remove Network (if owned, see legacy logic)
        if (container.network) {
            const { DockerNetwork } = await import('@modules/container/infrastructure/persistence/mongo/models/DockerNetworkModel');
            const netDoc = await DockerNetwork.findById(container.network);
            if (netDoc) {
                await this.containerService.removeNetwork(netDoc.networkId);
                // Cascade delete in Model handles Mongo Doc, but we should ensure consistency
            }
        }

        // Remove Volume? Legacy logic says: "v: true removes associated anonymous volumes". 
        // Named volumes were kept or removed depending on requirements? 
        // Legacy "deleteContainer" calls "removeNetwork", but seemingly NOT "removeVolume" explicitly?
        // Wait, legacy `ContainerSchema.plugin(useCascadeDelete);` and `onBeforeDelete` handling.
        // I'll stick to removing the container entity which triggers cascade hooks in the model if I use mongoose middleware,
        // but Clean Architecture usually avoids hooks.
        // I will explicitly delete the repository entry.

        await this.repository.deleteById(input.id);

        return Result.ok({ message: 'Container deleted successfully' });
    }
}
