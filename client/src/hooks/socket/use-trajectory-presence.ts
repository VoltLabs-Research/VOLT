/**
 * Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Centralized hook for managing trajectory presence subscriptions
 * This prevents multiple subscriptions to the same trajectory
 */

import { useEffect, useState, useRef } from 'react';
import { socketService } from '@/services/socketio';

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

// Global socket listeners(only one per event)
let globalListenersInitialized = false;

const initializeGlobalListeners = () => {
    if(globalListenersInitialized) return;
    globalListenersInitialized = true;

    // Listen to ALL canvas user updates
    socketService.on('canvas_users_update', (data: { trajectoryId: string; users: CardPresenceUser[] }) => {
        const sub = activeSubscriptions.get(data.trajectoryId);
        if(sub){
            sub.canvasUsers = data.users;
            const combined = [...sub.canvasUsers, ...sub.rasterUsers];
            const unique = combined.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );
            sub.listeners.forEach(listener => listener(unique));
        }
    });

    // Listen to ALL raster user updates
    socketService.on('raster_users_update', (data: { trajectoryId: string; users: CardPresenceUser[] }) => {
        const sub = activeSubscriptions.get(data.trajectoryId);
        if(sub){
            sub.rasterUsers = data.users;
            const combined = [...sub.canvasUsers, ...sub.rasterUsers];
            const unique = combined.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );
            sub.listeners.forEach(listener => listener(unique));
        }
    });

    // No need for onAny listener - the specific events above handle all cases
};

export const useTrajectoryPresence = (trajectoryId: string) => {
    const [users, setUsers] = useState<CardPresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());
    const listenerRef = useRef<(users: CardPresenceUser[]) => void>();

    // Monitor connection status
    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected: boolean) => {
            setIsConnected(connected);
        });
        return unsubscribe;
    }, []);

    // Subscribe to trajectory presence
    useEffect(() => {
        if(!isConnected || !trajectoryId){
            return;
        }

        // Initialize global listeners once
        initializeGlobalListeners();

        // Create or get subscription
        let sub = activeSubscriptions.get(trajectoryId);

        if(!sub){
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

        // Create listener for this component
        listenerRef.current = (combinedUsers: CardPresenceUser[]) => {
            setUsers(combinedUsers);
        };

        sub.listeners.add(listenerRef.current);

        // Only emit observe events if we're the first subscription AND not currently emitting
        // Check count === 1 to ensure we're truly the first component to subscribe
        if(sub.count === 1 && !sub.isEmitting){
            // Mark as emitting IMMEDIATELY(synchronously) to prevent race conditions
            sub.isEmitting = true;

            // Emit both presence observe events
            Promise.all([
                socketService.emit('observe_canvas_presence', { trajectoryId }),
                socketService.emit('observe_raster_presence', { trajectoryId })
            ]).then(() => {
                const currentSub = activeSubscriptions.get(trajectoryId);
                if(currentSub){
                    currentSub.isEmitting = false;
                }
            }).catch((error) => {
                console.error('[useTrajectoryPresence] Failed to observe:', error);
                const currentSub = activeSubscriptions.get(trajectoryId);
                if(currentSub){
                    currentSub.isEmitting = false;
                }
            });
        }

        // Cleanup
        return() => {
            const sub = activeSubscriptions.get(trajectoryId);
            if(sub && listenerRef.current){
                sub.listeners.delete(listenerRef.current);
                sub.count--;

                // Clean up subscription if no more listeners
                if(sub.count <= 0){
                    activeSubscriptions.delete(trajectoryId);
                }
            }
        };
    }, [isConnected, trajectoryId]);

    return { users, isConnected };
};
