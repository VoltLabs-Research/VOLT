import { CONTAINER_TOKENS } from '@modules/container/di/ContainerTokens';
import { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '@modules/container/dtos/GetContainerFilesDTO';
import type { IContainerOwnershipService } from '@modules/container/ports/IContainerOwnershipService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/ports/ITeamClusterContainerRuntimeService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerFilesUseCase implements IUseCase<GetContainerFilesInputDTO, GetContainerFilesOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private readonly containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(CONTAINER_TOKENS.ContainerOwnershipService) private readonly ownershipService: IContainerOwnershipService
    ) {}

    async execute(input: GetContainerFilesInputDTO): Promise<GetContainerFilesOutputDTO> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        const files = await this.containerRuntimeService.getFiles(teamClusterId, container.containerId, input.path || '/');

        return { files };
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
}
