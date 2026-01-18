import { container } from 'tsyringe';
import { NOTIFICATION_TOKENS } from './NotificationTokens';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repository/NotificationRepository';

export const registerNotificationDependencies = () => {
    container.registerSingleton(NOTIFICATION_TOKENS.NotificationRepository, NotificationRepository);
};
