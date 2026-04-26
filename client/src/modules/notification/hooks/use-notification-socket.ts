import { SOCKET_NOTIFICATION_EVENTS } from '@/modules/socket/events/notification';
import { prependNotificationToInfiniteCache } from './queries';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import type { Notification } from '../api/entities/notification';

const useNotificationSocket = (limit = 20): void => {
    useSocketEvent<Notification>(SOCKET_NOTIFICATION_EVENTS.RECEIVED, (notification) => {
        prependNotificationToInfiniteCache({ limit }, notification);
    });
};

export default useNotificationSocket;
