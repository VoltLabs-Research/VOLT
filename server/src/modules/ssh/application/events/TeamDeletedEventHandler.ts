import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        protected readonly repository: ISSHConnectionRepository
    ) {
        super();
    }
}
