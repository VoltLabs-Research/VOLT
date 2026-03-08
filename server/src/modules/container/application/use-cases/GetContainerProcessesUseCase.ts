import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { GetContainerProcessesInputDTO, GetContainerProcessesOutputDTO } from '@modules/container/application/dtos/GetContainerProcessesDTO';
import { ContainerOwnershipService } from '@modules/container/application/services/ContainerOwnershipService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';

@injectable()
export class GetContainerProcessesUseCase implements IUseCase<GetContainerProcessesInputDTO, GetContainerProcessesOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ){}

    async execute(input: GetContainerProcessesInputDTO): Promise<Result<GetContainerProcessesOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        const processes = await this.containerService.getProcesses(container.containerId);

        return Result.ok({ processes });
    }
}
