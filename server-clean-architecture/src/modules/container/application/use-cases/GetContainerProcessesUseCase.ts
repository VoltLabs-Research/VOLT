import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';
import { GetContainerProcessesOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';

@injectable()
export class GetContainerProcessesUseCase implements IUseCase<{ containerId: string }, GetContainerProcessesOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async execute(input: { containerId: string }): Promise<Result<GetContainerProcessesOutputDTO>> {
        const container = await this.repository.findById(input.containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const processes = await this.containerService.getProcesses(container.containerId);

        return Result.ok({ processes });
    }
}
