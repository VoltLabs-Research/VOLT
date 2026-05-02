import { ErrorCodes } from '@core/constants/error-codes';
import { ListSSHFilesInputDTO } from '@modules/ssh/application/dtos/ListSSHFilesInputDTO';
import { ListSSHFilesOutputDTO, SSHFileEntryDTO } from '@modules/ssh/application/dtos/ListSSHFilesOutputDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import { resolveSSHServiceError } from '@modules/ssh/application/utils/ssh-error-utils';
import SSHConnectionService from '@modules/ssh/infrastructure/services/SSHConnectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class ListSSHFilesUseCase implements IUseCase<ListSSHFilesInputDTO, ListSSHFilesOutputDTO, ApplicationError>{
    constructor(
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,
        private readonly sshConnService: SSHConnectionService
    ){}

    async execute(input: ListSSHFilesInputDTO): Promise<Result<ListSSHFilesOutputDTO, ApplicationError>>{
        const {
            sshConnectionId,
            teamId,
            path
        } = input;
        const sshConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeamWithCredentials(sshConnectionId, teamId);

        if (!sshConnectionResult.success) {
            return Result.fail(sshConnectionResult.error);
        }

        try {
            const remotePath = path || '.';
            const files = await this.sshConnService.listFiles(sshConnectionResult.value, remotePath);

            const entries: SSHFileEntryDTO[] = files.map((file) => ({
                type: file.isDirectory ? 'dir' : 'file',
                name: file.name,
                relPath: file.path,
                size: file.size,
                mtime: file.mtime.toISOString()
            }));

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
}
