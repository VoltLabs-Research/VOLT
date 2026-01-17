import { container } from 'tsyringe';
import { NOTIFICATION_TOKENS } from './NotificationTokens';
import NotificationRepository from '../persistence/mongo/repository/NotificationRepository';

export const registerNotificationDependencies = () => {
    container.registerSingleton(NOTIFICATION_TOKENS.NotificationRepository, NotificationRepository);
};
