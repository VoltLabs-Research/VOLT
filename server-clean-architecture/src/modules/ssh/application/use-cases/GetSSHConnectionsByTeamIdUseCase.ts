import { Result } from '@/src/shared/domain/ports/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '../../infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';
import { GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO } from '../dtos/GetSSHConnectionsByTeamId';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export class GetSSHConnectionsByTeamIdUseCase implements IUseCase<GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ) { }

    async execute(input: GetSSHConnectionsByTeamIdInputDTO): Promise<Result<GetSSHConnectionsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const results = await this.sshConnRepository.findAll({ filter: { team: teamId }, limit: 100, page: 1 });
        return Result.ok({
            ...results,
            data: results.data.map(conn => conn.props)
        });
    }
};