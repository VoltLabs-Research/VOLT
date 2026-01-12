import { Result } from '@/src/shared/domain/ports/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '../../infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';
import { TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO } from '../dtos/TestSSHConnectionByIdDTO';
import { ISSHConnectionService } from '../../domain/ports/ISSHConnectionService';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export default class TestSSHConnectionsByIdUseCase implements IUseCase<TestSSHConnectionByIdInputDTO, TestSSHConnectionByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository,
        @inject(SSH_CONN_TOKENS.SSHConnectionService)
        private sshConnService: ISSHConnectionService
    ){}

    async execute(input: TestSSHConnectionByIdInputDTO): Promise<Result<TestSSHConnectionByIdOutputDTO, ApplicationError>>{
        const { sshConnectionId } = input;
        const sshConnection = await this.sshConnRepository.findById(sshConnectionId);
        if(!sshConnection){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }
        const result = await this.sshConnService.testConnection(sshConnection);
        return Result.ok({ valid: result });
    }
};