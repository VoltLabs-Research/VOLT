import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetContainerStatsOutputDTO } from '../dtos/ContainerDTOs';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import { IContainerService } from '../../domain/ports/IContainerService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/shared/domain/constants/ErrorCodes';

@injectable()
export class GetContainerStatsUseCase implements IUseCase<{ id: string }, GetContainerStatsOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ) { }

    async execute(input: { id: string }): Promise<Result<GetContainerStatsOutputDTO>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const stats = await this.containerService.getStats(container.containerId);

        return Result.ok({
            stats,
            limits: {
                memory: container.memory * 1024 * 1024,
                cpus: container.cpus
            }
        });
    }
}
