import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
import type { PresenceUser } from '@volt/contracts/modules/socket/domain';

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

const useWhiteboardPresence = ({ whiteboardId, enabled = true }: UseWhiteboardPresenceProps) => {
    const previousUsersRef = useRef<PresenceUser[]>([]);

    const users = usePresenceStore((state) => state.users);
    const announcement = usePresenceStore((state) => state.announcement);

    useSocketEvent<PresenceUser[]>(SOCKET_WHITEBOARD_EVENTS.USERS_UPDATE, (nextUsers) => {
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
    }, { enabled: enabled && !!whiteboardId });

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
        }

        return () => {
            setUsers([]);
            setAnnouncement(null);
            previousUsersRef.current = [];
        };
    }, [whiteboardId, enabled]);

    return {
        users,
        announcement
    };
};

export default useWhiteboardPresence;
