import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/di/AuthTokens';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository
    ) {}

    async handle(event: TeamDeletedEvent): Promise<void> {
        await this.userRepository.removeUsersFromTeam(event.payload.teamId);
    }
}
