import { injectable, inject } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        protected readonly repository: ISSHConnectionRepository
    ){
        super();
    }
}
