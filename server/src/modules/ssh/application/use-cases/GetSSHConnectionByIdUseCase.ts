import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import { GetSSHConnectionByIdInputDTO } from '@modules/ssh/application/dtos/GetSSHConnectionByIdDTO';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import { toSafeSSHConnectionDTO } from '@modules/ssh/application/utils/ssh-error-utils';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetSSHConnectionByIdUseCase implements IUseCase<GetSSHConnectionByIdInputDTO, SafeSSHConnectionDTO, ApplicationError> {
    constructor(
        
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
