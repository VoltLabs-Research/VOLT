import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { DeleteSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/DeleteSSHConnectionByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class DeleteSSHConnectionByIdUseCase implements IUseCase<DeleteSSHConnectionByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ) { }

    async execute(input: DeleteSSHConnectionByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const { sshConnectionId } = input;
        const result = await this.sshConnRepository.deleteById(sshConnectionId);
        if (!result) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_DELETE_ERROR,
                'SSH connection delete error'
            ));
        }
        return Result.ok(null);
    }
};