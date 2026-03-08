import { NOTIFICATION_SOCKET_EVENTS } from '../api/entities/notification-constants';
import { prependNotificationToInfiniteCache } from './queries';
import { useEffect } from 'react';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import type { Notification } from '../api/entities/notification';

interface NotificationSubscription {
    references: number;
    unsubscribe: () => void;
};

const subscriptionRegistry = new Map<string, NotificationSubscription>();

const getSubscriptionKey = (teamId: string, limit: number): string => {
    return `${teamId}:${limit}`;
};

const useNotificationSocket = (teamId?: string, limit = 20): void => {
    const socketService = useSocket();

    useEffect(() => {
        if (!teamId) {
            return;
        }

        const subscriptionKey = getSubscriptionKey(teamId, limit);
        const existingSubscription = subscriptionRegistry.get(subscriptionKey);

        if (existingSubscription) {
            existingSubscription.references += 1;
            return () => {
                existingSubscription.references -= 1;
                if (existingSubscription.references === 0) {
                    existingSubscription.unsubscribe();
                    subscriptionRegistry.delete(subscriptionKey);
                }
            };
        }

        const handleNotification = (notification: Notification): void => {
            prependNotificationToInfiniteCache({ teamId, limit }, notification);
        };

        const unsubscribe = socketService.on<[Notification]>(
            NOTIFICATION_SOCKET_EVENTS.RECEIVED,
            handleNotification
        );

        subscriptionRegistry.set(subscriptionKey, {
            references: 1,
            unsubscribe
        });

        return () => {
            const subscription = subscriptionRegistry.get(subscriptionKey);
            if (!subscription) {
                return;
            }

            subscription.references -= 1;
            if (subscription.references === 0) {
                subscription.unsubscribe();
                subscriptionRegistry.delete(subscriptionKey);
            }
        };
    }, [limit, socketService, teamId]);
};

export default useNotificationSocket;
