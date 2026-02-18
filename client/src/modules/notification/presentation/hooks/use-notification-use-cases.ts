import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { NOTIFICATION_TOKENS } from '@/modules/notification/infrastructure/di/tokens';
import type INotificationRepository from '@/modules/notification/domain/ports/INotificationRepository';

const useNotificationUseCases = createUseCasesHook({
    notificationRepository: NOTIFICATION_TOKENS.NotificationRepository
}) as () => {
    notificationRepository: INotificationRepository;
};

export default useNotificationUseCases;
