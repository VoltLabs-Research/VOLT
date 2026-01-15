import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import UserDeletedEvent from '@/src/modules/auth/domain/events/UserDeletedEvent';
import { TEAM_TOKENS } from '../../infrastructure/di/TeamTokens';
import { ITeamRepository } from '../../domain/ports/ITeamRepository';

@injectable()
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.teamRepository.removeUserFromAllTeams(userId);
    }
}
