import { container } from 'tsyringe';
import { NOTIFICATION_TOKENS } from './tokens';
import NotificationRepository from '../repositories/NotificationRepository';
import type INotificationRepository from '../../domain/ports/INotificationRepository';

export const ensureNotificationDI = (): void => {
    container.register<INotificationRepository>(
        NOTIFICATION_TOKENS.NotificationRepository,
        NotificationRepository
    );
};
