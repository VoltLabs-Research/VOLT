import {
    type GetTeamClusterRuntimeSnapshotInputDTO,
    type GetTeamClusterRuntimeSnapshotOutputDTO,
    type DaemonQueueSnapshotEntry
} from '@modules/cluster/application/dtos/GetTeamClusterRuntimeSnapshotDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ServerSideQueueConcurrencyCoordinator from '@modules/cluster/infrastructure/services/ServerSideQueueConcurrencyCoordinator';
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
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly serverSideQueueConcurrencyCoordinator: ServerSideQueueConcurrencyCoordinator
    ) {}

    async execute(
        input: GetTeamClusterRuntimeSnapshotInputDTO
    ): Promise<Result<GetTeamClusterRuntimeSnapshotOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const serverSnapshot = this.serverSideQueueConcurrencyCoordinator.snapshot();

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
            queueConcurrency: { ...teamCluster.props.queueConcurrency },
            daemonQueues,
            serverQueues: [
                { name: 'trajectory_compression', location: 'server', concurrency: serverSnapshot.trajectoryCompression },
                { name: 'cloud_upload', location: 'server', concurrency: serverSnapshot.cloudUpload },
                { name: 'trajectory_background_processor', location: 'server', concurrency: serverSnapshot.trajectoryBackgroundProcessor }
            ]
        });
    }
}
