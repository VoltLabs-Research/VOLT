import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { CreateSSHConnectionInputDTO, CreateSSHConnectionOutputDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import { v4 } from 'uuid';

@injectable()
export class CreateSSHConnectionUseCase implements IUseCase<CreateSSHConnectionInputDTO, CreateSSHConnectionOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnectionRepo: ISSHConnectionRepository
    ){}

    async execute(input: CreateSSHConnectionInputDTO): Promise<Result<CreateSSHConnectionOutputDTO, ApplicationError>> {
        // TODO: ID
        const sshConnection = SSHConnection.create('', input);
        const result = await this.sshConnectionRepo.create(sshConnection.props);

        return Result.ok({
            _id: result.id,
            ...sshConnection.props
        });
    }
}