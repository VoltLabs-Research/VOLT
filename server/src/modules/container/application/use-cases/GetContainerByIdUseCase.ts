import { GetContainerByIdInputDTO, GetContainerByIdOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<GetContainerByIdInputDTO, GetContainerByIdOutputDTO> {
    constructor(
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService
    ) {}

    async execute(input: GetContainerByIdInputDTO): Promise<Result<GetContainerByIdOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        if (container.teamCluster) {
            const runtimeContainer = await this.containerRuntimeService.getContainer(container.teamCluster, container.containerId);
            if (runtimeContainer.State?.Status) {
                container.status = runtimeContainer.State.Status;
            }
        }

        return Result.ok({ container });
    }
};
