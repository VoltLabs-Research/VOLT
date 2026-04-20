import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { CreateSSHConnectionInputDTO, CreateSSHConnectionOutputDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { ISSHCredentialsCipher } from '@modules/ssh/domain/port/ISSHCredentialsCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import SSHConnectionCreatedEvent from '@modules/ssh/domain/events/SSHConnectionCreatedEvent';
import {
    resolveSSHPersistenceError,
    toSafeSSHConnectionDTO
} from '@modules/ssh/application/utils/ssh-error-utils';

@injectable()
export class CreateSSHConnectionUseCase implements IUseCase<CreateSSHConnectionInputDTO, CreateSSHConnectionOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnectionRepo: ISSHConnectionRepository,

        @inject(SSH_TOKENS.SSHCredentialsCipher)
        private readonly sshCredentialsCipher: ISSHCredentialsCipher,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateSSHConnectionInputDTO): Promise<Result<CreateSSHConnectionOutputDTO, ApplicationError>> {
        if (input.password.trim().length === 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'SSH connection password is required'
            ));
        }

        const sshConnection = SSHConnection.create('', {
            ...input,
            encryptedPassword: await this.sshCredentialsCipher.encrypt(input.password)
        });

        if (!sshConnection) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'SSH connection password is required'
            ));
        }

        let result: SSHConnection;

        try {
            result = await this.sshConnectionRepo.create(sshConnection.props);
        } catch (error: unknown) {
            return Result.fail(resolveSSHPersistenceError(
                error,
                'An SSH connection with this name already exists for this team',
                'Invalid SSH connection input',
                'Failed to create SSH connection'
            ));
        }

        await this.eventBus.publish(new SSHConnectionCreatedEvent({
            sshConnectionId: result._id,
            teamId: input.teamId,
            name: input.name
        }));

        return Result.ok(toSafeSSHConnectionDTO(result));
    }
}
