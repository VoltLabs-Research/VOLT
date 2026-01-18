import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';

@injectable()
export class GetContainerFilesUseCase implements IUseCase<{ id: string; path?: string }, { files: any[] }> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async execute(input: { id: string; path?: string }): Promise<Result<{ files: any[] }>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const files = await this.containerService.getFiles(container.containerId, input.path || '/');

        return Result.ok({ files });
    }
}
