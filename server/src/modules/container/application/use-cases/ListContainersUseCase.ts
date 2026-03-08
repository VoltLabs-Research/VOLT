import { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface ListContainersFilter {
    team: string;
};

@injectable()
export class ListContainersUseCase implements IUseCase<ListContainersInputDTO, ListContainersOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository
    ) {}

    async execute(input: ListContainersInputDTO): Promise<Result<ListContainersOutputDTO>> {
        const filter: ListContainersFilter = {
            team: input.teamId
        };

        const result = await this.repository.findAll({
            filter,
            page: input.page,
            limit: input.limit
        });

        return Result.ok(result);
    }
};
