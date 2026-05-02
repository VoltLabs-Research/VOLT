import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { GetSSHConnectionsByTeamIdInputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionsByTeamIdDTO';
import { toSafeSSHConnectionDTO } from '@modules/ssh/application/utils/ssh-error-utils';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetSSHConnectionsByTeamIdUseCase implements IUseCase<GetSSHConnectionsByTeamIdInputDTO, PaginatedResult<SafeSSHConnectionDTO>, ApplicationError> {
    constructor(
        private sshConnRepository: SSHConnectionRepository
    ){}

    async execute(input: GetSSHConnectionsByTeamIdInputDTO): Promise<Result<PaginatedResult<SafeSSHConnectionDTO>, ApplicationError>> {
        const { teamId } = input;
        const results = await this.sshConnRepository.findAll({ filter: { team: teamId }, limit: input.limit, page: input.page });
        return Result.ok({
            ...results,
            data: results.data.map((connection) => toSafeSSHConnectionDTO(connection))
        });
    }
}
