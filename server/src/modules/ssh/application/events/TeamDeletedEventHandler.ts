import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';

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
