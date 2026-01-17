import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import { IContainerService } from '../../domain/ports/IContainerService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/shared/domain/constants/ErrorCodes';

@injectable()
export class ReadContainerFileUseCase implements IUseCase<{ id: string; path: string }, { content: string }> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ) { }

    async execute(input: { id: string; path: string }): Promise<Result<{ content: string }>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const content = await this.containerService.readFile(container.containerId, input.path);

        return Result.ok({ content });
    }
}
