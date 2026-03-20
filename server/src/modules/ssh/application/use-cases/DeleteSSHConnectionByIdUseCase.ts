import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import type { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { DeleteSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/DeleteSSHConnectionByIdDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import SSHConnectionDeletedEvent from '@modules/ssh/domain/events/SSHConnectionDeletedEvent';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IEventBus } from '@shared/application/events/IEventBus';

@injectable()
export class DeleteSSHConnectionByIdUseCase implements IUseCase<DeleteSSHConnectionByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(SSHConnectionOwnershipService)
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,

        @inject(SSH_TOKENS.SSHConnectionRepository)
        private readonly sshConnRepository: ISSHConnectionRepository,

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
};
