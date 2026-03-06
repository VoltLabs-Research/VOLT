import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class ReadContainerFileUseCase implements IUseCase<{ containerId: string; path: string }, { content: string }> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async execute(input: { containerId: string; path: string }): Promise<Result<{ content: string }>> {
        const container = await this.repository.findById(input.containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        const content = await this.containerService.readFile(container.containerId, input.path);

        return Result.ok({ content });
    }
}
