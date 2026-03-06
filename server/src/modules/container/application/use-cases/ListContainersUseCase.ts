import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';

@injectable()
export class ListContainersUseCase implements IUseCase<ListContainersInputDTO, ListContainersOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository
    ){}

    async execute(input: ListContainersInputDTO): Promise<Result<ListContainersOutputDTO>> {
        const result = await this.repository.findAll({
            filter: { team: input.teamId },
            page: input.page,
            limit: input.limit
        });

        return Result.ok(result)
    }
}
