import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { GetContainerByIdOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<{ containerId: string }, GetContainerByIdOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository
    ){}

    async execute(input: { containerId: string }): Promise<Result<GetContainerByIdOutputDTO>> {
        const container = await this.repository.findById(input.containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }
        return Result.ok({ container });
    }
}
