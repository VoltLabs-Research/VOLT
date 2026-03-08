import { useEffect } from 'react';
import useSocket from '@/modules/socket/hooks/use-socket';
import { NOTIFICATION_SOCKET_EVENTS } from '../api/entities/notification-constants';
import type { Notification } from '../api/entities/notification';
import { prependNotificationToInfiniteCache } from './queries';

const subscriptionRegistry = new Map<string, {
    references: number;
    unsubscribe: () => void;
}>();

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

        const unsubscribe = socketService.on(
            NOTIFICATION_SOCKET_EVENTS.RECEIVED,
            ((notification: Notification) => {
                prependNotificationToInfiniteCache({ teamId, limit }, notification);
            }) as (...args: unknown[]) => void
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
