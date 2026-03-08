import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';

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
};
