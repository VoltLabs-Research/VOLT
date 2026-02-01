import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import { useNotificationStore } from '../stores/use-notification-store';
import type { Notification } from '@/modules/notification/domain/entities';

const useNotificationSocket = (): void => {
    const addNotification = useNotificationStore((state) => state.addNotification);

    useSocketEvent<Notification>('notification', (notification) => {
        addNotification(notification);
    });
};

export default useNotificationSocket;
