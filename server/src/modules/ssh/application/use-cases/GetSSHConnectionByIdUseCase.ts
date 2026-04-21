import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { GetSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionByIdDTO';
import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { toSafeSSHConnectionDTO } from '@modules/ssh/application/utils/ssh-error-utils';

@injectable()
export class GetSSHConnectionByIdUseCase implements IUseCase<GetSSHConnectionByIdInputDTO, SafeSSHConnectionDTO, ApplicationError> {
    constructor(
        @inject(SSHConnectionOwnershipService)
        private readonly sshConnectionOwnershipService: SSHConnectionOwnershipService
    ){}

    async execute(input: GetSSHConnectionByIdInputDTO): Promise<Result<SafeSSHConnectionDTO, ApplicationError>> {
        const { sshConnectionId, teamId } = input;
        const existingConnectionResult = await this.sshConnectionOwnershipService.getOwnedByTeam(sshConnectionId, teamId);

        if (!existingConnectionResult.success) {
            return Result.fail(existingConnectionResult.error);
        }

        return Result.ok(toSafeSSHConnectionDTO(existingConnectionResult.value));
    }
};
