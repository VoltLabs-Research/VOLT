import { SOCKET_NOTIFICATION_EVENTS } from '@/modules/socket/events/notification';
import { prependNotificationToInfiniteCache } from '../../hooks/queries';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import type { Notification } from '@volt/contracts/modules/notification/domain';

const useNotificationSocket = (): void => {
    useSocketEvent<Notification>(SOCKET_NOTIFICATION_EVENTS.RECEIVED, prependNotificationToInfiniteCache);
};

export default useNotificationSocket;
