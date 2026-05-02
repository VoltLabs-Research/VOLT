import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        private readonly userRepository: UserRepository
    ) {}

    async handle(event: TeamDeletedEvent): Promise<void> {
        await this.userRepository.removeUsersFromTeam(event.payload.teamId);
    }
}
