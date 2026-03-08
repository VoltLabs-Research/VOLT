import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ISSHCredentialsCipher } from '@modules/ssh/domain/port/ISSHCredentialsCipher';
import { UpdateSSHConnectionByIdInputDTO, UpdateSSHConnectionByIdOutputDTO } from '@modules/ssh/application/dtos/UpdateSSHConnectionByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import type { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import {
    resolveSSHPersistenceError,
    toSafeSSHConnectionDTO
} from '@modules/ssh/application/utils/ssh-error-utils';

@injectable()
export class UpdateSSHConnectionByIdUseCase implements IUseCase<UpdateSSHConnectionByIdInputDTO, UpdateSSHConnectionByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,

        @inject(SSH_TOKENS.SSHCredentialsCipher)
        private readonly sshCredentialsCipher: ISSHCredentialsCipher
    ){}

    async execute(input: UpdateSSHConnectionByIdInputDTO): Promise<Result<UpdateSSHConnectionByIdOutputDTO, ApplicationError>> {
        const {
            host,
            name,
            port,
            sshConnectionId,
            teamId,
            username,
            password
        } = input;
        const existingConnection = await this.sshConnRepository.findById(sshConnectionId);

        if (!existingConnection || existingConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
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
            updateData.encryptedPassword = this.sshCredentialsCipher.encrypt(password);
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
};
