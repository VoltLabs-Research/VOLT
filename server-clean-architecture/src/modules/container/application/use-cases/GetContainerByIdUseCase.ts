import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetContainerByIdOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<{ id: string }, GetContainerByIdOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository
    ){}

    async execute(input: { id: string }): Promise<Result<GetContainerByIdOutputDTO>> {
        const container = await this.repository.findById(input.id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }
        return Result.ok({ container });
    }
}
