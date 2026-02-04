import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

export interface CanvasPresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

interface UseCanvasPresenceProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const presenceState = {
    canvasUsers: [] as CanvasPresenceUser[],
    rasterUsers: [] as CanvasPresenceUser[],
    listeners: new Set<() => void>(),
};

const notifyListeners = () => {
    presenceState.listeners.forEach(l => l());
};

const setCanvasUsers = (users: CanvasPresenceUser[]) => {
    presenceState.canvasUsers = users;
    notifyListeners();
};

const setRasterUsers = (users: CanvasPresenceUser[]) => {
    presenceState.rasterUsers = users;
    notifyListeners();
};

const subscribe = (listener: () => void) => {
    presenceState.listeners.add(listener);
    return () => presenceState.listeners.delete(listener);
};

const getSnapshot = () => presenceState;

const useCanvasPresence = ({ trajectoryId, enabled = true }: UseCanvasPresenceProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);

    const state = useSyncExternalStore(subscribe, getSnapshot);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if(connected && enabled && trajectoryId && !subscribedRef.current){
                subscribeToPresence();
            }
        });
        return unsubscribe;
    }, [enabled, trajectoryId, socketService]);

    const subscribeToPresence = useCallback(() => {
        if(!enabled || !trajectoryId || !isConnectedRef.current || subscribedRef.current){
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
        if(!enabled || !trajectoryId){
            return;
        }

        if(isConnectedRef.current){
            subscribeToPresence();
        }

        const unsubscribeCanvas = socketService.on('canvas_users_update', setCanvasUsers);
        const unsubscribeRaster = socketService.on('raster_users_update', setRasterUsers);

        return () => {
            subscribedRef.current = false;
            unsubscribeCanvas();
            unsubscribeRaster();

            if(isConnectedRef.current){
                socketService.emit('unsubscribe_from_canvas', { trajectoryId }).catch(() => { });
                socketService.emit('unsubscribe_from_raster', { trajectoryId }).catch(() => { });
            }

            setCanvasUsers([]);
            setRasterUsers([]);
        };
    }, [trajectoryId, enabled, subscribeToPresence, socketService]);

    return useMemo(() => ({
        canvasUsers: state.canvasUsers,
        rasterUsers: state.rasterUsers,
        allUsers: [...state.canvasUsers, ...state.rasterUsers]
    }), [state.canvasUsers, state.rasterUsers]);
};

export default useCanvasPresence;
