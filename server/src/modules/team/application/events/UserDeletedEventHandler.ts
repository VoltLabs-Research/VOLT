import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent>{
    constructor(
        
        private readonly teamRepository: TeamRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.teamRepository.removeUserFromAllTeams(userId);
    }
};
