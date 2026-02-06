import { useMemo } from 'react';
import { container } from 'tsyringe';
import { NOTIFICATION_TOKENS } from '@/modules/notification/infrastructure/di/tokens';
import type INotificationRepository from '@/modules/notification/domain/ports/INotificationRepository';

const useNotificationUseCases = () => {
    return useMemo(() => ({
        notificationRepository: container.resolve<INotificationRepository>(
            NOTIFICATION_TOKENS.NotificationRepository
        )
    }), []);
};

export default useNotificationUseCases;
