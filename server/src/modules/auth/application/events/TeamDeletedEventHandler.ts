import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
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
