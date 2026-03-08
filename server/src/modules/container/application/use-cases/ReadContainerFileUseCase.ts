import { ReadContainerFileInputDTO, ReadContainerFileOutputDTO } from '@modules/container/application/dtos/ReadContainerFileDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ReadContainerFileUseCase implements IUseCase<ReadContainerFileInputDTO, ReadContainerFileOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: ReadContainerFileInputDTO): Promise<Result<ReadContainerFileOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        const content = await this.containerService.readFile(container.containerId, input.path);

        return Result.ok({ content });
    }
};
