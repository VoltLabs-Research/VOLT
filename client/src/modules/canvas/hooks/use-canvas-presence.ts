import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import useSocket from '@/modules/socket/hooks/use-socket';

export interface CanvasPresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

interface PresenceState {
    canvasUsers: CanvasPresenceUser[];
    rasterUsers: CanvasPresenceUser[];
}

interface UseCanvasPresenceProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const usePresenceStore = create<PresenceState>(() => ({
    canvasUsers: [],
    rasterUsers: []
}));

const setUsers = (key: 'canvasUsers' | 'rasterUsers', users: CanvasPresenceUser[]) => {
    usePresenceStore.setState({ [key]: users });
};

const useCanvasPresence = ({ trajectoryId, enabled = true }: UseCanvasPresenceProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);

    const canvasUsers = usePresenceStore((state) => state.canvasUsers);
    const rasterUsers = usePresenceStore((state) => state.rasterUsers);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if (connected && enabled && trajectoryId && !subscribedRef.current) {
                subscribeToPresence();
            }
        });
        return unsubscribe;
    }, [enabled, trajectoryId, socketService]);

    const subscribeToPresence = useCallback(() => {
        if (!enabled || !trajectoryId || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        subscribedRef.current = true;

        socketService.emit('subscribe_to_canvas', {
            trajectoryId,
            previousTrajectoryId: undefined
        }).catch(console.warn);

        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).catch(console.warn);
    }, [enabled, trajectoryId, socketService]);

    useEffect(() => {
        if (!enabled || !trajectoryId) return;

        if (isConnectedRef.current) {
            subscribeToPresence();
        }

        const unsubscribeCanvas = socketService.on('canvas_users_update', (users) => setUsers('canvasUsers', users as CanvasPresenceUser[]));
        const unsubscribeRaster = socketService.on('raster_users_update', (users) => setUsers('rasterUsers', users as CanvasPresenceUser[]));

        return () => {
            subscribedRef.current = false;
            unsubscribeCanvas();
            unsubscribeRaster();

            if (isConnectedRef.current) {
                socketService.emit('unsubscribe_from_canvas', { trajectoryId }).catch(console.warn);
                socketService.emit('unsubscribe_from_raster', { trajectoryId }).catch(console.warn);
            }

            setUsers('canvasUsers', []);
            setUsers('rasterUsers', []);
        };
    }, [trajectoryId, enabled, subscribeToPresence, socketService]);

    return {
        canvasUsers,
        rasterUsers,
        allUsers: [...canvasUsers, ...rasterUsers]
    };
};

export default useCanvasPresence;
