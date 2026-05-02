import { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '@modules/container/application/dtos/GetContainerFilesDTO';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetContainerFilesUseCase implements IUseCase<GetContainerFilesInputDTO, GetContainerFilesOutputDTO> {
    constructor(
        private containerRuntimeService: DaemonContainerRuntimeService,
        private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerFilesInputDTO): Promise<Result<GetContainerFilesOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        const files = await this.containerRuntimeService.getFiles(teamClusterId, container.containerId, input.path || '/');

        return Result.ok({ files });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
}
