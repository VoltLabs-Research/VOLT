import { SOCKET_TRAJECTORY_PRESENCE_EVENTS } from '@/modules/socket/events/trajectory';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import { useEffect, useState } from 'react';
import type { PresenceUser } from '@volt/contracts/modules/socket/domain';
import type { TrajectoryPresenceUpdateSocketPayload } from '@/modules/socket/events/trajectory';

interface UseTrajectoryPresenceResult {
    users: PresenceUser[];
}

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

    useSocketEvent<TrajectoryPresenceUpdateSocketPayload>(
        SOCKET_TRAJECTORY_PRESENCE_EVENTS.UPDATE,
        setUsers,
        { enabled: !!trajectoryId }
    );

    useEffect(() => {
        setUsers([]);
    }, [trajectoryId]);

    return { users };
}
