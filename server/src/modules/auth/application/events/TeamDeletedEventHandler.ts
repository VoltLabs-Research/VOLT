import { injectable, inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void> {
        await this.userRepository.removeUsersFromTeam(event.payload.teamId);
    }
}
