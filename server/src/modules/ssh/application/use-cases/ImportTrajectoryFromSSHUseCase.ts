import { Result } from '@shared/domain/port/Result';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ImportTrajectoryFromSSHInputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHOutputDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { v4 } from 'uuid';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: ImportTrajectoryFromSSHInputDTO): Promise<Result<ImportTrajectoryFromSSHOutputDTO, ApplicationError>>{
        const { sshConnectionId, remotePath, teamId, userId } = input;

        const sshConnection = await this.sshConnRepository.findByIdWithCredentials(sshConnectionId);

        if (!sshConnection || sshConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

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

        try {
            const trajectoryId = v4();
            const trajectoryName = `Import: ${remotePath.split('/').pop() || remotePath}`;

            await this.teamClusterDaemonClient.request(connectedTeamCluster.id, '/api/orchestration/queue-dispatch', {
                method: 'POST',
                body: {
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
                }
            });

            return Result.ok({
                message: 'Import request sent to the team cluster daemon',
                trajectoryId
            });
        } catch (error: unknown) {
            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_IMPORT_ERROR,
                'Failed to queue SSH import job',
                500
            ));
        }
    }
};
