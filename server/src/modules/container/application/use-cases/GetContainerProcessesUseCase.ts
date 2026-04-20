import { GetContainerProcessesInputDTO, GetContainerProcessesOutputDTO } from '@modules/container/application/dtos/GetContainerProcessesDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerProcessesUseCase implements IUseCase<GetContainerProcessesInputDTO, GetContainerProcessesOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerProcessesInputDTO): Promise<Result<GetContainerProcessesOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        const processes = await this.containerRuntimeService.getProcesses(teamClusterId, container.containerId);

        return Result.ok({ processes });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
};
