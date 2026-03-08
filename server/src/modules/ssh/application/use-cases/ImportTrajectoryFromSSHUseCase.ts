import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ISSHImportQueue } from '@modules/ssh/domain/port/ISSHImportQueue';
import { ImportTrajectoryFromSSHInputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHOutputDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { v4 } from 'uuid';
import Job from '@modules/jobs/domain/entities/Job';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_CONN_TOKENS.SSHImportQueue)
        private sshImportQueue: ISSHImportQueue
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

        try {
            const jobId = v4();
            const sessionId = v4();
            const queueId = v4();

            const trajectoryName = `Import: ${remotePath.split('/').pop() || remotePath}`;

            const job = Job.create({
                jobId,
                teamId,
                sessionId,
                queueType: 'ssh_import',
                message: `From ${sshConnection.props.username}@${sshConnection.props.host}`,
                metadata: {
                    trajectoryId: `import-${queueId}`,
                    trajectoryName,
                    timestep: 0,
                    name: 'Import Trajectory',
                    sshConnectionId,
                    remotePath,
                    userId
                }
            });

            await this.sshImportQueue.addJobs([job]);

            return Result.ok({
                jobId,
                sessionId,
                message: 'Import job queued successfully'
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
