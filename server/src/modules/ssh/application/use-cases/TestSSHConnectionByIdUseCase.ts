import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO } from '@modules/ssh/application/dtos/TestSSHConnectionByIdDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import { ISSHConnectionService } from '@modules/ssh/domain/port/ISSHConnectionService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { resolveSSHServiceError } from '@modules/ssh/application/utils/ssh-error-utils';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class TestSSHConnectionByIdUseCase implements IUseCase<TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSHConnectionOwnershipService)
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,

        @inject(SSH_TOKENS.SSHConnectionService)
        private readonly sshConnService: ISSHConnectionService
    ){}

    async execute(input: TestSSHConnectionByIdInputDTO): Promise<Result<TestSSHConnectionByIdOutputDTO, ApplicationError>> {
        const {
            sshConnectionId,
            teamId
        } = input;
        const sshConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeamWithCredentials(sshConnectionId, teamId);

        if (!sshConnectionResult.success) {
            return Result.fail(sshConnectionResult.error);
        }

        try {
            await this.sshConnService.testConnection(sshConnectionResult.value);
            return Result.ok({ valid: true });
        } catch (error: unknown) {
            return Result.fail(resolveSSHServiceError(
                error,
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to test SSH connection'
            ));
        }
    }
};
