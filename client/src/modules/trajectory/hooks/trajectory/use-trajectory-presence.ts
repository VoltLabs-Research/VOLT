import { SOCKET_TRAJECTORY_PRESENCE_EVENTS } from '@/modules/socket/events/trajectory';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import { useEffect, useState } from 'react';
import type { PresenceUser } from '@/modules/socket/types/presence-user';

interface TrajectoryPresencePayload {
    trajectoryId: string;
    users: PresenceUser[];
};

interface UseTrajectoryPresenceResult {
    users: PresenceUser[];
};

export default function useTrajectoryPresence(trajectoryId: string | undefined): UseTrajectoryPresenceResult {
    const [users, setUsers] = useState<PresenceUser[]>([]);

    useSocketRoom({
        joinEvent: SOCKET_TRAJECTORY_PRESENCE_EVENTS.JOIN,
        leaveEvent: SOCKET_TRAJECTORY_PRESENCE_EVENTS.LEAVE,
        roomKey: trajectoryId,
        buildJoinPayload: () => trajectoryId ? { trajectoryId } : null,
        enabled: !!trajectoryId,
        fireAndForget: true
    });

    useSocketEvent<TrajectoryPresencePayload>(SOCKET_TRAJECTORY_PRESENCE_EVENTS.UPDATE, (data) => {
        if (data.trajectoryId === trajectoryId) {
            setUsers(data.users);
        }
    }, { enabled: !!trajectoryId });

    useEffect(() => {
        setUsers([]);
    }, [trajectoryId]);

    return { users };
}
