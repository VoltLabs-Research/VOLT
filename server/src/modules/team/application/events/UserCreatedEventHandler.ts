import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject, delay } from 'tsyringe';

@injectable()
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {
    constructor(
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: UserCreatedEvent): Promise<void> {
        const { id, firstName } = event.payload;

        await this.createNotificationUseCase.execute({
            recipient: id,
            title: 'Welcome to Volt!',
            content: `Hi ${firstName}, get started by creating your first team and connecting a cluster.`,
            link: '/onboarding'
        });
    }
};
