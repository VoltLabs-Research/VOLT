import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { DeleteSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/DeleteSSHConnectionByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import SSHConnectionDeletedEvent from '@modules/ssh/domain/events/SSHConnectionDeletedEvent';

@injectable()
export class DeleteSSHConnectionByIdUseCase implements IUseCase<DeleteSSHConnectionByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteSSHConnectionByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { sshConnectionId, teamId } = input;
        const existingConnection = await this.sshConnRepository.findById(sshConnectionId);

        if (!existingConnection || existingConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        const result = await this.sshConnRepository.deleteById(sshConnectionId);

        if (!result) {
            return Result.fail(new ApplicationError(
                ErrorCodes.SSH_CONNECTION_DELETE_ERROR,
                'Failed to delete SSH connection',
                500
            ));
        }

        await this.eventBus.publish(new SSHConnectionDeletedEvent({
            sshConnectionId,
            teamId
        }));

        return Result.ok(null);
    }
};
