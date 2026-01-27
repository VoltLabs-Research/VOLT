import { useEffect, useState, useRef } from 'react';
import { getTrajectoryUseCases } from '../../application/registry';
import type { TrajectoryUseCases } from '../../application/registry';

export interface CardPresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

// Global state to track active subscriptions
const activeSubscriptions = new Map<string, {
    count: number;
    canvasUsers: CardPresenceUser[];
    rasterUsers: CardPresenceUser[];
    listeners: Set<(users: CardPresenceUser[]) => void>;
    isEmitting: boolean; // Track if we're currently emitting observe events
}>();

// Global socket listeners (only one per event)
let globalListenersInitialized = false;

const resolveUseCases = (): TrajectoryUseCases => getTrajectoryUseCases();

const initializeGlobalListeners = (trajectoryPresenceSocketUseCase: TrajectoryUseCases['trajectoryPresenceSocketUseCase']) => {
    if (globalListenersInitialized) return;
    globalListenersInitialized = true;

    // Listen to ALL canvas user updates
    trajectoryPresenceSocketUseCase.onCanvasUsersUpdate((data: { trajectoryId: string; users: CardPresenceUser[] }) => {
        const sub = activeSubscriptions.get(data.trajectoryId);
        if (sub) {
            sub.canvasUsers = data.users;
            const combined = [...sub.canvasUsers, ...sub.rasterUsers];
            const unique = combined.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );
            sub.listeners.forEach(listener => listener(unique));
        }
    });

    // Listen to ALL raster user updates
    trajectoryPresenceSocketUseCase.onRasterUsersUpdate((data: { trajectoryId: string; users: CardPresenceUser[] }) => {
        const sub = activeSubscriptions.get(data.trajectoryId);
        if (sub) {
            sub.rasterUsers = data.users;
            const combined = [...sub.canvasUsers, ...sub.rasterUsers];
            const unique = combined.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );
            sub.listeners.forEach(listener => listener(unique));
        }
    });
};

export const useTrajectoryPresence = (trajectoryId: string) => {
    const { trajectoryPresenceSocketUseCase } = resolveUseCases();
    const [users, setUsers] = useState<CardPresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(() => trajectoryPresenceSocketUseCase.isConnected());
    const listenerRef = useRef<((users: CardPresenceUser[]) => void) | null>(null);

    // Monitor connection status
    useEffect(() => {
        const unsubscribe = trajectoryPresenceSocketUseCase.onConnectionChange((connected: boolean) => {
            setIsConnected(connected);
        });
        return unsubscribe;
    }, [trajectoryPresenceSocketUseCase]);

    // Subscribe to trajectory presence
    useEffect(() => {
        if (!isConnected || !trajectoryId) {
            return;
        }

        initializeGlobalListeners(trajectoryPresenceSocketUseCase);

        let sub = activeSubscriptions.get(trajectoryId);

        if (!sub) {
            sub = {
                count: 0,
                canvasUsers: [],
                rasterUsers: [],
                listeners: new Set(),
                isEmitting: false
            };
            activeSubscriptions.set(trajectoryId, sub);
        }

        sub.count++;

        listenerRef.current = (combinedUsers: CardPresenceUser[]) => {
            setUsers(combinedUsers);
        };

        sub.listeners.add(listenerRef.current);

        if (sub.count === 1 && !sub.isEmitting) {
            sub.isEmitting = true;

            Promise.all([
                trajectoryPresenceSocketUseCase.observeCanvasPresence(trajectoryId),
                trajectoryPresenceSocketUseCase.observeRasterPresence(trajectoryId)
            ]).then(() => {
                const currentSub = activeSubscriptions.get(trajectoryId);
                if (currentSub) {
                    currentSub.isEmitting = false;
                }
            }).catch((error) => {
                console.error('[useTrajectoryPresence] Failed to observe:', error);
                const currentSub = activeSubscriptions.get(trajectoryId);
                if (currentSub) {
                    currentSub.isEmitting = false;
                }
            });
        }

        return () => {
            const sub = activeSubscriptions.get(trajectoryId);
            if (sub && listenerRef.current) {
                sub.listeners.delete(listenerRef.current);
                sub.count--;

                if (sub.count <= 0) {
                    activeSubscriptions.delete(trajectoryId);
                }
            }
        };
    }, [isConnected, trajectoryId, trajectoryPresenceSocketUseCase]);

    return { users, isConnected };
};
