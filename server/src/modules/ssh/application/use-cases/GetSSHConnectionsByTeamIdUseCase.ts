import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionsByTeamIdDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { toSafeSSHConnectionDTO } from '@modules/ssh/application/utils/ssh-error-utils';

@injectable()
export class GetSSHConnectionsByTeamIdUseCase implements IUseCase<GetSSHConnectionsByTeamIdInputDTO, GetSSHConnectionsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private sshConnRepository: ISSHConnectionRepository
    ){}

    async execute(input: GetSSHConnectionsByTeamIdInputDTO): Promise<Result<GetSSHConnectionsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const results = await this.sshConnRepository.findAll({ filter: { team: teamId }, limit: input.limit, page: input.page });
        return Result.ok({
            ...results,
            data: results.data.map((connection) => toSafeSSHConnectionDTO(connection))
        });
    }
};
