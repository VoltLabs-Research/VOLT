import { Result } from '@/src/shared/domain/ports/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '../../infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';
import { ImportTrajectoryFromSSHInputDTO } from '../dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '../dtos/ImportTrajectoryFromSSHOutputDTO';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import SSHImportQueue from '../../infrastructure/queues/SSHImportQueue';
import { v4 } from 'uuid';
import Job from '@/src/modules/jobs/domain/entities/Job';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_CONN_TOKENS.SSHImportQueue)
        private sshImportQueue: SSHImportQueue
    ){}

    async execute(input: ImportTrajectoryFromSSHInputDTO): Promise<Result<ImportTrajectoryFromSSHOutputDTO, ApplicationError>>{
        const { sshConnectionId, remotePath, teamId, userId } = input;

        // Get SSH connection from repository
        const sshConnection = await this.sshConnRepository.findByIdWithCredentials(sshConnectionId);
        if(!sshConnection){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        try{
            // Generate unique IDs for job and session
            const jobId = v4();
            const sessionId = v4();
            const queueId = v4();

            // Extract trajectory name from remote path
            const trajectoryName = `Import: ${remotePath.split('/').pop() || remotePath}`;

            // Create job with metadata for SSH import
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

            // Add job to queue
            await this.sshImportQueue.addJobs([job]);

            return Result.ok({
                jobId,
                sessionId,
                message: 'Import job queued successfully'
            });
        }catch(error: any){
            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_IMPORT_ERROR,
                `Failed to queue SSH import job: ${error.message}`,
                500
            ));
        }
    }
};
