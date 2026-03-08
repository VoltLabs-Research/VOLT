import { SOCKET_TRAJECTORY_PRESENCE_EVENTS } from '@/modules/socket/trajectory/constants/trajectory-presence-socket-events';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface TrajectoryPresencePayload {
    trajectoryId: string;
    users: PresenceUser[];
};

interface UseTrajectoryPresenceResult {
    users: PresenceUser[];
    join: () => void;
    leave: () => void;
};

export default function useTrajectoryPresence(trajectoryId: string | undefined): UseTrajectoryPresenceResult {
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const socket = useSocket();
    const joinedRef = useRef(false);

    const join = useCallback(() => {
        if (!trajectoryId || joinedRef.current) return;
        socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.JOIN, { trajectoryId });
        joinedRef.current = true;
    }, [trajectoryId, socket]);

    const leave = useCallback(() => {
        if (!trajectoryId || !joinedRef.current) return;
        socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.LEAVE, { trajectoryId });
        joinedRef.current = false;
    }, [trajectoryId, socket]);

    useSocketEvent<TrajectoryPresencePayload>(SOCKET_TRAJECTORY_PRESENCE_EVENTS.UPDATE, (data) => {
        if (data.trajectoryId === trajectoryId) {
            setUsers(data.users);
        }
    }, { enabled: !!trajectoryId });

    useEffect(() => {
        setUsers([]);

        if (!trajectoryId) {
            joinedRef.current = false;
        }
    }, [trajectoryId]);

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.JOIN, { trajectoryId });
        joinedRef.current = true;

        return () => {
            socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.LEAVE, { trajectoryId });
            joinedRef.current = false;
        };
    }, [trajectoryId, socket]);

    return { users, join, leave };
}
