import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/DeleteSSHConnectionByIdDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import SSHConnectionDeletedEvent from '@modules/ssh/domain/events/SSHConnectionDeletedEvent';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteSSHConnectionByIdUseCase implements IUseCase<DeleteSSHConnectionByIdInputDTO, null, ApplicationError> {
    constructor(
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,
        private readonly sshConnRepository: SSHConnectionRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteSSHConnectionByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { sshConnectionId, teamId } = input;
        const existingConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeam(sshConnectionId, teamId);

        if (!existingConnectionResult.success) {
            return Result.fail(existingConnectionResult.error);
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
}
