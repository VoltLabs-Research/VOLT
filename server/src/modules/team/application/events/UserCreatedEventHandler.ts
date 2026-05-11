import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { inject, delay } from 'tsyringe';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.created')
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {
    constructor(
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: UserCreatedEvent): Promise<void> {
        const { id, firstName } = event.payload;

        await this.createNotificationUseCase.execute({
            recipient: id,
            title: 'Create your first team',
            content: `Hi ${firstName}, get started by creating your first team and connecting a cluster.`,
            link: '/onboarding'
        });
    }
};
