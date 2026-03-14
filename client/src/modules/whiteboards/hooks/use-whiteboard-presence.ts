import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface WhiteboardPresenceAnnouncement {
    message: string;
    timestamp: number;
};

interface WhiteboardPresenceState {
    users: PresenceUser[];
    announcement: WhiteboardPresenceAnnouncement | null;
};

interface UseWhiteboardPresenceProps {
    whiteboardId?: string;
    enabled?: boolean;
};

const usePresenceStore = create<WhiteboardPresenceState>(() => ({
    users: [],
    announcement: null
}));

const setUsers = (users: PresenceUser[]) => {
    usePresenceStore.setState({ users });
};

const setAnnouncement = (announcement: WhiteboardPresenceAnnouncement | null) => {
    usePresenceStore.setState({ announcement });
};

const getPresenceUserName = (user: PresenceUser): string => {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName || 'A collaborator';
};

const isPresencePayload = (value: unknown): value is PresenceUser[] => {
    return Array.isArray(value);
};

const useWhiteboardPresence = ({ whiteboardId, enabled = true }: UseWhiteboardPresenceProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);
    const previousUsersRef = useRef<PresenceUser[]>([]);

    const users = usePresenceStore((state) => state.users);
    const announcement = usePresenceStore((state) => state.announcement);

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
            (incomingUsers) => {
                if (!isPresencePayload(incomingUsers)) {
                    return;
                }

                const nextUsers = incomingUsers;
                const previousUsers = previousUsersRef.current;
                const previousIds = new Set(previousUsers.map((user) => user.id));
                const nextIds = new Set(nextUsers.map((user) => user.id));
                const joinedUser = nextUsers.find((user) => !previousIds.has(user.id));
                const leftUser = previousUsers.find((user) => !nextIds.has(user.id));

                if (joinedUser) {
                    setAnnouncement({
                        message: `${getPresenceUserName(joinedUser)} joined the whiteboard.`,
                        timestamp: Date.now()
                    });
                } else if (leftUser) {
                    setAnnouncement({
                        message: `${getPresenceUserName(leftUser)} left the whiteboard.`,
                        timestamp: Date.now()
                    });
                }

                previousUsersRef.current = nextUsers;
                setUsers(nextUsers);
            }
        );

        return () => {
            subscribedRef.current = false;
            unsubscribePresence();

            if (isConnectedRef.current) {
                socketService.emit('unsubscribe_from_whiteboard', { whiteboardId }).catch(console.warn);
            }

            setUsers([]);
            setAnnouncement(null);
            previousUsersRef.current = [];
        };
    }, [whiteboardId, enabled, subscribeToPresence, socketService]);

    return { users, announcement };
};

export default useWhiteboardPresence;
