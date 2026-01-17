import { Result } from '@/src/shared/domain/ports/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '../../infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';
import { ISSHConnectionService } from '../../domain/ports/ISSHConnectionService';
import { ListSSHFilesInputDTO } from '../dtos/ListSSHFilesInputDTO';
import { ListSSHFilesOutputDTO, SSHFileEntryDTO } from '../dtos/ListSSHFilesOutputDTO';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';

@injectable()
export default class ListSSHFilesUseCase implements IUseCase<ListSSHFilesInputDTO, ListSSHFilesOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_CONN_TOKENS.SSHConnectionService)
        private sshConnService: ISSHConnectionService
    ){}

    async execute(input: ListSSHFilesInputDTO): Promise<Result<ListSSHFilesOutputDTO, ApplicationError>>{
        const { sshConnectionId, path } = input;

        // Get SSH connection from repository
        const sshConnection = await this.sshConnRepository.findByIdWithCredentials(sshConnectionId);
        if(!sshConnection){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        try{
            // Default path to current directory if not provided
            const remotePath = path || '.';

            // List files using the SSH service
            const files = await this.sshConnService.listFiles(sshConnection, remotePath);

            // Map to DTO format
            const entries: SSHFileEntryDTO[] = files.map(f => ({
                type: f.isDirectory ? 'dir' : 'file',
                name: f.name,
                relPath: f.path,
                size: f.size,
                mtime: f.mtime.toISOString()
            }));

            return Result.ok({
                cwd: remotePath,
                entries
            });
        }catch(error: any){
            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_LIST_FILES_ERROR,
                `Failed to list SSH files: ${error.message}`,
                500
            ));
        }
    }
};
