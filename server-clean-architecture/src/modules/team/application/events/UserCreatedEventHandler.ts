import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject, delay } from 'tsyringe';
import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import CreateTeamUseCase from '@modules/team/application/use-cases/team/CreateTeamUseCase';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';

@injectable()
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {
    constructor(
        @inject(delay(() => CreateTeamUseCase))
        private readonly createTeamUseCase: CreateTeamUseCase,
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ) { }

    async handle(event: UserCreatedEvent): Promise<void> {
        const { id, firstName, lastName } = event.payload;

        const result = await this.createTeamUseCase.execute({
            name: `${firstName} ${lastName}'s Team`,
            description: `Default team for ${firstName} ${lastName}`,
            ownerId: id
        });

        if (result.success) {
            const team = result.value;
            await this.createNotificationUseCase.execute({
                recipient: id,
                title: 'Your personal team is ready',
                content: `We've automatically created a team for you called "${team.name}". All your new trajectories can be added here.`,
                link: `/teams/${team.id}`
            });
        }
    }
};
