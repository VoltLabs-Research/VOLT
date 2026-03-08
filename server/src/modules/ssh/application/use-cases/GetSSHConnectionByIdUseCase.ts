import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { GetSSHConnectionByIdInputDTO, GetSSHConnectionByIdOutputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { toSafeSSHConnectionDTO } from './ssh-error-utils';

@injectable()
export class GetSSHConnectionByIdUseCase implements IUseCase<GetSSHConnectionByIdInputDTO, GetSSHConnectionByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ){}

    async execute(input: GetSSHConnectionByIdInputDTO): Promise<Result<GetSSHConnectionByIdOutputDTO, ApplicationError>> {
        const { sshConnectionId, teamId } = input;
        const existingConnection = await this.sshConnRepository.findById(sshConnectionId);

        if (!existingConnection || existingConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        return Result.ok(toSafeSSHConnectionDTO(existingConnection));
    }
};
