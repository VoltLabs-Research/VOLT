import { ErrorCodes } from '@core/constants/error-codes';
import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { UpdateSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/UpdateSSHConnectionByIdDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import {
    resolveSSHPersistenceError,
    toSafeSSHConnectionDTO
} from '@modules/ssh/application/utils/ssh-error-utils';
import type SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import type { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHCredentialsCipher from '@modules/ssh/infrastructure/services/SSHCredentialsCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class UpdateSSHConnectionByIdUseCase implements IUseCase<UpdateSSHConnectionByIdInputDTO, SafeSSHConnectionDTO, ApplicationError> {
    constructor(
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,
        private readonly sshConnRepository: SSHConnectionRepository,
        private readonly sshCredentialsCipher: SSHCredentialsCipher
    ){}

    async execute(input: UpdateSSHConnectionByIdInputDTO): Promise<Result<SafeSSHConnectionDTO, ApplicationError>> {
        const {
            host,
            name,
            port,
            sshConnectionId,
            teamId,
            username,
            password
        } = input;
        const existingConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeam(sshConnectionId, teamId);

        if (!existingConnectionResult.success) {
            return Result.fail(existingConnectionResult.error);
        }

        const updateData: Partial<SSHConnectionProps> = {};

        if (typeof host === 'string') {
            updateData.host = host;
        }

        if (typeof name === 'string') {
            updateData.name = name;
        }

        if (typeof port === 'number') {
            updateData.port = port;
        }

        if (typeof username === 'string') {
            updateData.username = username;
        }

        if (typeof password === 'string' && password.trim().length > 0) {
            updateData.encryptedPassword = await this.sshCredentialsCipher.encrypt(password);
        }

        let result: SSHConnection | null;

        try {
            result = await this.sshConnRepository.updateById(sshConnectionId, updateData);
        } catch (error: unknown) {
            return Result.fail(resolveSSHPersistenceError(
                error,
                'An SSH connection with this name already exists for this team',
                'Invalid SSH connection input',
                'Failed to update SSH connection'
            ));
        }

        if (!result) {
            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_CONNECTION_UPDATE_ERROR,
                'Failed to update SSH connection',
                500
            ));
        }

        return Result.ok(toSafeSSHConnectionDTO(result));
    }
}
