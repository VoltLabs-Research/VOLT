import { ErrorCodes } from '@core/constants/error-codes';
import { ImportTrajectoryFromSSHInputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHOutputDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import { v4 } from 'uuid';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,

        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
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
        const jobId = `ssh-import:${trajectoryId}`;
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

            await this.teamClusterDaemonClient.command(connectedTeamCluster.id, ChannelCommands.QueueDispatch, {
                queueName: 'ssh_import',
                payload: {
                    jobId,
                    teamId,
                    sshConnectionId,
                    remotePath,
                    userId,
                    host: sshConnection.props.host,
                    port: sshConnection.props.port,
                    username: sshConnection.props.username,
                    encryptedPassword: sshConnection.props.encryptedPassword,
                    trajectoryId
                }
            });
            queued = true;

            await this.daemonAnalysisCompletionService.handleQueuedJobs([
                {
                    jobId,
                    name: 'Import trajectory from SSH',
                    teamId,
                    queueType: 'ssh_import',
                    trajectoryId,
                    trajectoryName
                }
            ], 'ssh-import', connectedTeamCluster.id).catch((projectionError) => {
                logger.warn(
                    { err: projectionError, jobId, teamId, trajectoryId },
                    'Failed to project queued SSH import job'
                );
            });

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
