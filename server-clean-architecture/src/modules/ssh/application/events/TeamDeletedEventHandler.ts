import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';
import { SSH_CONN_TOKENS } from '../../infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(SSH_CONN_TOKENS.SSHConnectionRepository)
        private readonly sshConnectionRepository: ISSHConnectionRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId } = event.payload;

        await this.sshConnectionRepository.deleteMany({ team: teamId });
    }
}
