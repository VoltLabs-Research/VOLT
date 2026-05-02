import { ErrorCodes } from '@core/constants/error-codes';
import { TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO } from '@modules/ssh/application/dtos/TestSSHConnectionByIdDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import { resolveSSHServiceError } from '@modules/ssh/application/utils/ssh-error-utils';
import SSHConnectionService from '@modules/ssh/infrastructure/services/SSHConnectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class TestSSHConnectionByIdUseCase implements IUseCase<TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO, ApplicationError> {
    constructor(
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService,
        private readonly sshConnService: SSHConnectionService
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
}
