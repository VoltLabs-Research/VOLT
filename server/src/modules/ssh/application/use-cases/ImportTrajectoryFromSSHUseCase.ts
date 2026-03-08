import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ISSHImportQueue } from '@modules/ssh/domain/port/ISSHImportQueue';
import { ImportTrajectoryFromSSHInputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHInputDTO';
import { ImportTrajectoryFromSSHOutputDTO } from '@modules/ssh/application/dtos/ImportTrajectoryFromSSHOutputDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class ImportTrajectoryFromSSHUseCase implements IUseCase<ImportTrajectoryFromSSHInputDTO, ImportTrajectoryFromSSHOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_TOKENS.SSHImportQueue)
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
            const { jobId, sessionId } = await this.sshImportQueue.enqueueImportJob({
                teamId,
                sshConnectionId,
                remotePath,
                userId,
                host: sshConnection.props.host,
                username: sshConnection.props.username
            });

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
