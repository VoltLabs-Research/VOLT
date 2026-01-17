import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import { IContainerService } from '../../domain/ports/IContainerService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/shared/domain/constants/ErrorCodes';
import { GetContainerProcessesOutputDTO } from '../dtos/ContainerDTOs';

@injectable()
export class GetContainerProcessesUseCase implements IUseCase<{ id: string }, GetContainerProcessesOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ) { }

    async execute(input: { id: string }): Promise<Result<GetContainerProcessesOutputDTO>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const processes = await this.containerService.getProcesses(container.containerId);

        return Result.ok({ processes });
    }
}
