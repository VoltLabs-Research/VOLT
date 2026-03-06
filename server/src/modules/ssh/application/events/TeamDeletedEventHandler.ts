import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        protected readonly repository: ISSHConnectionRepository
    ) {
        super();
    }
}
