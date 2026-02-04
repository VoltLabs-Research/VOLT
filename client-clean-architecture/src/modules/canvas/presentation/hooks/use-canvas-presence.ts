import { useEffect, useRef, useCallback } from 'react';
import { createExternalStore, useExternalStore } from '@/modules/canvas/presentation/utils/external-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

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

const store = createExternalStore<PresenceState>({
    initialState: { canvasUsers: [], rasterUsers: [] }
});

const setUsers = (key: 'canvasUsers' | 'rasterUsers', users: CanvasPresenceUser[]) => {
    store.setState(prev => ({ ...prev, [key]: users }));
};

const useCanvasPresence = ({ trajectoryId, enabled = true }: UseCanvasPresenceProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);

    const state = useExternalStore(store);

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
        }).catch(() => { });

        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).catch(() => { });
    }, [enabled, trajectoryId, socketService]);

    useEffect(() => {
        if (!enabled || !trajectoryId) return;

        if (isConnectedRef.current) {
            subscribeToPresence();
        }

        const unsubscribeCanvas = socketService.on('canvas_users_update', (users) => setUsers('canvasUsers', users));
        const unsubscribeRaster = socketService.on('raster_users_update', (users) => setUsers('rasterUsers', users));

        return () => {
            subscribedRef.current = false;
            unsubscribeCanvas();
            unsubscribeRaster();

            if (isConnectedRef.current) {
                socketService.emit('unsubscribe_from_canvas', { trajectoryId }).catch(() => { });
                socketService.emit('unsubscribe_from_raster', { trajectoryId }).catch(() => { });
            }

            setUsers('canvasUsers', []);
            setUsers('rasterUsers', []);
        };
    }, [trajectoryId, enabled, subscribeToPresence, socketService]);

    return {
        canvasUsers: state.canvasUsers,
        rasterUsers: state.rasterUsers,
        allUsers: [...state.canvasUsers, ...state.rasterUsers]
    };
};

export default useCanvasPresence;
