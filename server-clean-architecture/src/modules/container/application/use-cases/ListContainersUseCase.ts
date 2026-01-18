import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ListContainersOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';

@injectable()
export class ListContainersUseCase implements IUseCase<{ teamId: string, userId: string }, ListContainersOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository
    ){}

    async execute(input: { teamId: string, userId: string }): Promise<Result<ListContainersOutputDTO>> {
        const result = await this.repository.findAll({
            filter: { team: input.teamId },
            page: 1, // Default, or pass from input
            limit: 100 // Large limit or pass from input
        });

        // Map to plain objects if needed, but repository returns Domain entities which are fine
        return Result.ok({ containers: result.data });
    }
}
