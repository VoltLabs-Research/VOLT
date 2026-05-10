import {
    type GetTeamClusterRuntimeSnapshotInputDTO,
    type GetTeamClusterRuntimeSnapshotOutputDTO,
    type DaemonQueueSnapshotEntry
} from '@modules/cluster/application/dtos/GetTeamClusterRuntimeSnapshotDTO';
import { toTeamClusterQueueConcurrencyDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface DaemonSnapshotResponse {
    accepted?: boolean;
    queues?: DaemonQueueSnapshotEntry[];
    capturedAt?: string;
}

@Singleton()
export default class GetTeamClusterRuntimeSnapshotUseCase
    implements IUseCase<GetTeamClusterRuntimeSnapshotInputDTO, GetTeamClusterRuntimeSnapshotOutputDTO, ApplicationError> {

    constructor(
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(
        input: GetTeamClusterRuntimeSnapshotInputDTO
    ): Promise<Result<GetTeamClusterRuntimeSnapshotOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
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

        return Result.ok({
            capturedAt,
            queueConcurrency: toTeamClusterQueueConcurrencyDTO(teamCluster.props.queueConcurrency),
            daemonQueues,
            serverQueues: []
        });
    }
}
