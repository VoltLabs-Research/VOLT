import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject, delay } from 'tsyringe';
import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';

@injectable()
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {
    constructor(
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ) { }

    async handle(event: UserCreatedEvent): Promise<void> {
        const { id, firstName } = event.payload;
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

        await this.createNotificationUseCase.execute({
            recipient: id,
            title: 'Welcome to the platform!',
            content: `We're excited to have you, ${capitalizedFirstName}. You can start by exploring your dashboard and uploading your first trajectory.`,
            link: '/dashboard'
        });
    }
}
