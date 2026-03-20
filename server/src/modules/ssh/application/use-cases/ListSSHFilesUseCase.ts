import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionService } from '@modules/ssh/domain/port/ISSHConnectionService';
import { ListSSHFilesInputDTO } from '@modules/ssh/application/dtos/ListSSHFilesInputDTO';
import { ListSSHFilesOutputDTO, SSHFileEntryDTO } from '@modules/ssh/application/dtos/ListSSHFilesOutputDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { resolveSSHServiceError } from '@modules/ssh/application/utils/ssh-error-utils';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class ListSSHFilesUseCase implements IUseCase<ListSSHFilesInputDTO, ListSSHFilesOutputDTO, ApplicationError>{
    constructor(
        @inject(SSHConnectionOwnershipService)
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,

        @inject(SSH_TOKENS.SSHConnectionService)
        private readonly sshConnService: ISSHConnectionService
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
