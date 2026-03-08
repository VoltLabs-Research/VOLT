import { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '@modules/container/application/dtos/GetContainerFilesDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/services/ContainerOwnershipService';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerFilesUseCase implements IUseCase<GetContainerFilesInputDTO, GetContainerFilesOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerFilesInputDTO): Promise<Result<GetContainerFilesOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        const files = await this.containerService.getFiles(container.containerId, input.path || '/');

        return Result.ok({ files });
    }
};
