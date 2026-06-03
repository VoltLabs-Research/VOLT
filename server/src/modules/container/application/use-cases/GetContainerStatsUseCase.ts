import { GetContainerStatsInputDTO, GetContainerStatsOutputDTO } from '@modules/container/application/dtos/GetContainerStatsDTO';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetContainerStatsUseCase implements IUseCase<GetContainerStatsInputDTO, GetContainerStatsOutputDTO> {
    constructor(
        private containerRuntimeService: DaemonContainerRuntimeService,
        private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerStatsInputDTO): Promise<Result<GetContainerStatsOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        const stats = await this.containerRuntimeService.getStats(teamClusterId, container.containerId);

        const usedBytes = stats.memory_stats?.usage ?? 0;
        const limitBytes = stats.memory_stats?.limit ?? 0;
        const usedMB = usedBytes / 1024 / 1024;
        const totalMB = limitBytes / 1024 / 1024;

        const networks = stats.networks ?? {};
        let rxBytes = 0;
        let txBytes = 0;
        for (const iface of Object.values(networks)) {
            rxBytes += iface.rx_bytes ?? 0;
            txBytes += iface.tx_bytes ?? 0;
        }

        return Result.ok({
            stats,
            limits: {
                memory: container.memory * 1024 * 1024,
                cpus: container.cpus
            },
            memoryMB: {
                used: Math.round(usedMB * 100) / 100,
                total: Math.round(totalMB * 100) / 100,
                free: Math.round((totalMB - usedMB) * 100) / 100
            },
            networkTotals: {
                rxBytes,
                txBytes
            }
        });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
}
