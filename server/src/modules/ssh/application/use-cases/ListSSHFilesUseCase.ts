import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ISSHConnectionService } from '@modules/ssh/domain/port/ISSHConnectionService';
import { ListSSHFilesInputDTO } from '@modules/ssh/application/dtos/ListSSHFilesInputDTO';
import { ListSSHFilesOutputDTO, SSHFileEntryDTO } from '@modules/ssh/application/dtos/ListSSHFilesOutputDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveSSHServiceError } from './ssh-error-utils';

@injectable()
export default class ListSSHFilesUseCase implements IUseCase<ListSSHFilesInputDTO, ListSSHFilesOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_CONN_TOKENS.SSHConnectionService)
        private sshConnService: ISSHConnectionService
    ){}

    async execute(input: ListSSHFilesInputDTO): Promise<Result<ListSSHFilesOutputDTO, ApplicationError>>{
        const {
            sshConnectionId,
            teamId,
            path
        } = input;
        const sshConnection = await this.sshConnRepository.findByIdWithCredentials(sshConnectionId);

        if (!sshConnection || sshConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        try {
            const remotePath = path || '.';
            const files = await this.sshConnService.listFiles(sshConnection, remotePath);

            const entries: SSHFileEntryDTO[] = files.map((file) => {
                const type = file.isDirectory ? 'dir' : 'file';

                return {
                    type,
                    name: file.name,
                    relPath: file.path,
                    size: file.size,
                    mtime: file.mtime.toISOString()
                };
            });

            return Result.ok({
                cwd: remotePath,
                entries
            });
        } catch (error: unknown) {
            return Result.fail(resolveSSHServiceError(
                error,
                ErrorCodes.SSH_LIST_FILES_ERROR,
                'Failed to list SSH files'
            ));
        }
    }
};
