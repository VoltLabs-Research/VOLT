import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import { GetContainerByIdInputDTO, GetContainerByIdOutputDTO } from '@modules/container/dtos/GetContainerByIdDTO';
import type { IContainerAccessiblePortResolver } from '@modules/container/ports/IContainerAccessiblePortResolver';
import type { IContainerOwnershipService } from '@modules/container/ports/IContainerOwnershipService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/ports/ITeamClusterContainerRuntimeService';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<GetContainerByIdInputDTO, GetContainerByIdOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerOwnershipService) private readonly ownershipService: IContainerOwnershipService,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private readonly containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(CONTAINER_TOKENS.ContainerAccessiblePortResolver) private readonly accessiblePortResolver: IContainerAccessiblePortResolver
    ) {}

    async execute(input: GetContainerByIdInputDTO): Promise<GetContainerByIdOutputDTO> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        if (container.teamCluster) {
            const runtimeContainer = await this.containerRuntimeService.getContainer(container.teamCluster, container.containerId);
            if (runtimeContainer.State?.Status) {
                container.status = runtimeContainer.State.Status;
            }
        }

        container.accessiblePorts = this.accessiblePortResolver.resolve(
            input.teamId,
            container._id,
            container.ports,
            container.status
        );

        return { container };
    }
}
