import { useEffect, useRef } from 'react';
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
    const previousUsersRef = useRef<PresenceUser[]>([]);

    const users = usePresenceStore((state) => state.users);
    const announcement = usePresenceStore((state) => state.announcement);

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
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
            unsubscribePresence();

            setUsers([]);
            setAnnouncement(null);
            previousUsersRef.current = [];
        };
    }, [whiteboardId, enabled, socketService]);

    return { users, announcement };
};

export default useWhiteboardPresence;
