import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';
import { GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionsByTeamId';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class GetSSHConnectionsByTeamIdUseCase implements IUseCase<GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ){}

    async execute(input: GetSSHConnectionsByTeamIdInputDTO): Promise<Result<GetSSHConnectionsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const results = await this.sshConnRepository.findAll({ filter: { team: teamId }, limit: 100, page: 1 });
        return Result.ok({
            ...results,
            data: results.data.map(conn => conn.props)
        });
    }
};