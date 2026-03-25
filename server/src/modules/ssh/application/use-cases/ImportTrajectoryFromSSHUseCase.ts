import { Result } from '@shared/domain/port/Result';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ImportTrajectoryFromSSHInputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHOutputDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { v4 } from 'uuid';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        @inject(SSHConnectionOwnershipService)
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: ImportTrajectoryFromSSHInputDTO): Promise<Result<ImportTrajectoryFromSSHOutputDTO, ApplicationError>>{
        const { sshConnectionId, remotePath, teamId, userId } = input;

        const sshConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeamWithCredentials(sshConnectionId, teamId);

        if (!sshConnectionResult.success) {
            return Result.fail(sshConnectionResult.error);
        }

        const sshConnection = sshConnectionResult.value;

        const teamClusters = await this.teamClusterRepository.findAll({
            filter: {
                team: teamId,
                status: TeamClusterStatus.Connected
            },
            sort: {
                createdAt: 1
            },
            page: 1,
            limit: 1
        });
        const connectedTeamCluster = teamClusters.data[0] as TeamCluster | undefined;

        if (!connectedTeamCluster) {
            return Result.fail(ApplicationError.conflict(
                'TeamCluster::ConnectedClusterRequired',
                'A connected team cluster is required for SSH trajectory import'
            ));
        }

        const trajectoryId = v4();
        let queued = false;

        try {
            const trajectoryName = `Import: ${remotePath.split('/').pop() || remotePath}`;

            await this.trajectoryRepository.createWithId(trajectoryId, {
                name: trajectoryName,
                team: teamId,
                folder: null,
                storageClusterId: connectedTeamCluster.id,
                createdBy: userId,
                status: TrajectoryStatus.WaitingForProcess,
                frames: [],
                stats: {
                    totalFiles: 0,
                    totalSize: 0
                },
                analysis: [],
                rasterSceneViews: 0,
                hasPreview: false,
                isPublic: true,
                updatedAt: new Date(),
                createdAt: new Date()
            });

            await this.teamClusterDaemonClient.command(connectedTeamCluster.id, TEAM_CLUSTER_DAEMON_COMMAND.queue.dispatch, {
                queueName: 'ssh_import',
                payload: {
                    teamId,
                    sshConnectionId,
                    remotePath,
                    userId,
                    host: sshConnection.props.host,
                    port: sshConnection.props.port,
                    username: sshConnection.props.username,
                    encryptedPassword: sshConnection.props.encryptedPassword,
                    trajectoryId,
                    trajectoryName
                }
            });
            queued = true;

            await this.eventBus.publish(new TrajectoryCreatedEvent({
                trajectoryId,
                trajectoryName,
                teamId,
                userId
            })).catch((publishError: unknown) => {
                logger.warn(
                    { err: publishError, trajectoryId, teamId },
                    'Failed to publish trajectory.created after SSH import queue dispatch'
                );
            });

            return Result.ok({
                message: 'Import request sent to the team cluster daemon',
                trajectoryId
            });
        } catch (error: unknown) {
            if (!queued) {
                await this.trajectoryRepository.deleteById(trajectoryId).catch(() => undefined);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_IMPORT_ERROR,
                'Failed to queue SSH import job',
                500
            ));
        }
    }
};
