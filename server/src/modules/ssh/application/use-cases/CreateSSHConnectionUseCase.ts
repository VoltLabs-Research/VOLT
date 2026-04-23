import { ErrorCodes } from '@core/constants/error-codes';
import { CreateSSHConnectionInputDTO, SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import {
    resolveSSHPersistenceError,
    toSafeSSHConnectionDTO
} from '@modules/ssh/application/utils/ssh-error-utils';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import SSHConnectionCreatedEvent from '@modules/ssh/domain/events/SSHConnectionCreatedEvent';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHCredentialsCipher from '@modules/ssh/infrastructure/services/SSHCredentialsCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateSSHConnectionUseCase implements IUseCase<CreateSSHConnectionInputDTO, SafeSSHConnectionDTO, ApplicationError> {
    constructor(
        
        private sshConnectionRepo: SSHConnectionRepository,

        
        private readonly sshCredentialsCipher: SSHCredentialsCipher,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateSSHConnectionInputDTO): Promise<Result<SafeSSHConnectionDTO, ApplicationError>> {
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
