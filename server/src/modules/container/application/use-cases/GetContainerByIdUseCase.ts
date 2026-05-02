import { GetContainerByIdInputDTO, GetContainerByIdOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import { ContainerAccessiblePortResolver } from '@modules/container/infrastructure/services/ContainerAccessiblePortResolver';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetContainerByIdUseCase implements IUseCase<GetContainerByIdInputDTO, GetContainerByIdOutputDTO> {
    constructor(
        private ownershipService: ContainerOwnershipService,
        private containerRuntimeService: DaemonContainerRuntimeService,
        private accessiblePortResolver: ContainerAccessiblePortResolver
    ) {}

    async execute(input: GetContainerByIdInputDTO): Promise<Result<GetContainerByIdOutputDTO>> {
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

        return Result.ok({ container });
    }
}
