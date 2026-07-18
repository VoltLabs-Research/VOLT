import NotificationService from '@modules/notification/services/NotificationService';
import type { UserCreatedIntegrationEvent } from '@shared/application/contracts/events/UserCreatedIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.created')
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedIntegrationEvent> {
    #notifications = new NotificationService();

    async handle(event: UserCreatedIntegrationEvent): Promise<void> {
        const { id, firstName } = event.payload;
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

        await this.#notifications.create({
            recipient: id,
            title: 'Welcome to the platform!',
            content: `We're excited to have you, ${capitalizedFirstName}. You can start by exploring your dashboard and uploading your first trajectory.`,
            link: '/dashboard'
        });
    }
}
