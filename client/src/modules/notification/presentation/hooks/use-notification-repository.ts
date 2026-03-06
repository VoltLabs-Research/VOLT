import useResolve from '@/shared/presentation/hooks/use-resolve';
import { NOTIFICATION_TOKENS } from '@/modules/notification/infrastructure/di/tokens';
import type INotificationRepository from '@/modules/notification/domain/port/INotificationRepository';

const useNotificationUseCases = () => {
    return {
        notificationRepository: useResolve<INotificationRepository>(NOTIFICATION_TOKENS.NotificationRepository)
    };
};

export default useNotificationUseCases;
