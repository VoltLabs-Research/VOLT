import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import {
    type GetTeamClusterRuntimeSnapshotInputDTO,
    type GetTeamClusterRuntimeSnapshotOutputDTO,
    type DaemonQueueSnapshotEntry
} from '@modules/cluster/dtos/GetTeamClusterRuntimeSnapshotDTO';
import { toTeamClusterQueueConcurrencyDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/cluster/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

interface DaemonSnapshotResponse {
    accepted?: boolean;
    queues?: DaemonQueueSnapshotEntry[];
    capturedAt?: string;
}

@Singleton()
export default class GetTeamClusterRuntimeSnapshotUseCase
    implements IUseCase<GetTeamClusterRuntimeSnapshotInputDTO, GetTeamClusterRuntimeSnapshotOutputDTO> {

    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(
        input: GetTeamClusterRuntimeSnapshotInputDTO
    ): Promise<GetTeamClusterRuntimeSnapshotOutputDTO> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            throw teamCluster;
        }

        let daemonQueues: DaemonQueueSnapshotEntry[] = [];
        let capturedAt = new Date().toISOString();

        if (teamCluster.props.status === TeamClusterStatus.Connected) {
            try {
                const response = await this.teamClusterDaemonClient.command<DaemonSnapshotResponse>(
                    teamCluster.id,
                    ChannelCommands.RuntimeQueuesSnapshot,
                    {},
                    { timeoutClass: 'default' }
                );
                daemonQueues = response.queues ?? [];
                capturedAt = response.capturedAt ?? capturedAt;
            } catch (error: unknown) {
                logger.warn(error, `[GetTeamClusterRuntimeSnapshotUseCase] daemon snapshot failed teamClusterId=${teamCluster.id}`);
            }
        }

        return {
            capturedAt,
            queueConcurrency: toTeamClusterQueueConcurrencyDTO(teamCluster.props.queueConcurrency),
            daemonQueues,
            serverQueues: []
        };
    }
}
