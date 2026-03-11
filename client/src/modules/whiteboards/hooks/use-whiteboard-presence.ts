import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface WhiteboardPresenceState {
    users: PresenceUser[];
};

interface UseWhiteboardPresenceProps {
    whiteboardId?: string;
    enabled?: boolean;
};

const usePresenceStore = create<WhiteboardPresenceState>(() => ({
    users: []
}));

const setUsers = (users: PresenceUser[]) => {
    usePresenceStore.setState({ users });
};

const useWhiteboardPresence = ({ whiteboardId, enabled = true }: UseWhiteboardPresenceProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);

    const users = usePresenceStore((state) => state.users);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if (connected && enabled && whiteboardId && !subscribedRef.current) {
                subscribeToPresence();
            }
        });
        return unsubscribe;
    }, [enabled, whiteboardId, socketService]);

    const subscribeToPresence = useCallback(() => {
        if (!enabled || !whiteboardId || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        subscribedRef.current = true;

        socketService.emit('subscribe_to_whiteboard', { whiteboardId }).catch(console.warn);
    }, [enabled, whiteboardId, socketService]);

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
        }

        if (isConnectedRef.current) {
            subscribeToPresence();
        }

        const unsubscribePresence = socketService.on(
            'whiteboard_users_update',
            (users) => setUsers(users as PresenceUser[])
        );

        return () => {
            subscribedRef.current = false;
            unsubscribePresence();

            if (isConnectedRef.current) {
                socketService.emit('unsubscribe_from_whiteboard', { whiteboardId }).catch(console.warn);
            }

            setUsers([]);
        };
    }, [whiteboardId, enabled, subscribeToPresence, socketService]);

    return { users };
};

export default useWhiteboardPresence;
