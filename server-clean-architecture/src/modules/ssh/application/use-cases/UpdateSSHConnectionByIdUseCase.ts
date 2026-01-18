import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';
import { UpdateSSHConnectionByIdInputDTO, UpdateSSHConnectionByIdOutputDTO } from '@modules/ssh/application/dtos/UpdateSSHConnectionByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class UpdateSSHConnectionByIdUseCase implements IUseCase<UpdateSSHConnectionByIdInputDTO, UpdateSSHConnectionByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ) { }

    async execute(input: UpdateSSHConnectionByIdInputDTO): Promise<Result<UpdateSSHConnectionByIdOutputDTO, ApplicationError>> {
        const { host, name, port, sshConnectionId, username } = input;
        const result = await this.sshConnRepository.updateById(sshConnectionId, {
            host,
            name,
            port,
            username
        });

        if (!result) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_UPDATE_ERROR,
                'SSH connection update error'
            ));
        }

        return Result.ok(result.props);
    }
};