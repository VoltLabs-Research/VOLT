import { GetContainerStatsInputDTO, GetContainerStatsOutputDTO } from '@modules/container/application/dtos/GetContainerStatsDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerStatsUseCase implements IUseCase<GetContainerStatsInputDTO, GetContainerStatsOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerStatsInputDTO): Promise<Result<GetContainerStatsOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        const stats = await this.containerRuntimeService.getStats(teamClusterId, container.containerId);

        return Result.ok({
            stats,
            limits: {
                memory: container.memory * 1024 * 1024,
                cpus: container.cpus
            }
        });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
};
