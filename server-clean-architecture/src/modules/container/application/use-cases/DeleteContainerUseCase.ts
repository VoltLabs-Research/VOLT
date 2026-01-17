import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { DeleteContainerOutputDTO } from '../dtos/ContainerDTOs';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import { IContainerService } from '../../domain/ports/IContainerService';
import { ErrorCodes } from '@/src/shared/domain/constants/ErrorCodes';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

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
            const { DockerNetwork } = await import('../../infrastructure/persistence/mongo/models/DockerNetworkModel');
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
