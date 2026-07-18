import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.teamRepository.removeUserFromAllTeams(userId);
    }
};
