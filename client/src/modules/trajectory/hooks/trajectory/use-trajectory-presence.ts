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
    const isConnectedRef = useRef(socket.isConnected());
    const joinedRef = useRef(false);

    const emitJoin = useCallback(() => {
        if (!trajectoryId || !isConnectedRef.current || joinedRef.current) return;
        joinedRef.current = true;
        socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.JOIN, { trajectoryId }).catch(() => {
            joinedRef.current = false;
        });
    }, [trajectoryId, socket]);

    const emitLeave = useCallback(() => {
        if (!trajectoryId || !isConnectedRef.current || !joinedRef.current) return;
        joinedRef.current = false;
        socket.emit(SOCKET_TRAJECTORY_PRESENCE_EVENTS.LEAVE, { trajectoryId }).catch(() => {});
    }, [trajectoryId, socket]);

    const join = useCallback(() => {
        if (!trajectoryId || joinedRef.current) return;
        emitJoin();
    }, [trajectoryId, emitJoin]);

    const leave = useCallback(() => {
        if (!trajectoryId || !joinedRef.current) return;
        emitLeave();
    }, [trajectoryId, emitLeave]);

    useSocketEvent<TrajectoryPresencePayload>(SOCKET_TRAJECTORY_PRESENCE_EVENTS.UPDATE, (data) => {
        if (data.trajectoryId === trajectoryId) {
            setUsers(data.users);
        }
    }, { enabled: !!trajectoryId });

    // Re-join on reconnection
    useEffect(() => {
        const unsubscribe = socket.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if (connected && trajectoryId && !joinedRef.current) {
                emitJoin();
            }
        });
        return unsubscribe;
    }, [trajectoryId, socket, emitJoin]);

    // Reset users when trajectoryId changes
    useEffect(() => {
        setUsers([]);
        if (!trajectoryId) {
            joinedRef.current = false;
        }
    }, [trajectoryId]);

    // Join on mount / leave on unmount or trajectoryId change
    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        if (isConnectedRef.current) {
            emitJoin();
        }

        return () => {
            emitLeave();
            setUsers([]);
        };
    }, [trajectoryId, emitJoin, emitLeave]);

    return { users, join, leave };
}
