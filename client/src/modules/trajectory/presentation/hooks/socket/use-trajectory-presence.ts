import { useState, useEffect, useCallback, useRef } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import type { PresenceUser } from '@/modules/socket/domain/entities';

interface TrajectoryPresencePayload{
    trajectoryId: string;
    users: PresenceUser[];
};

interface UseTrajectoryPresenceResult{
    users: PresenceUser[];
    join: () => void;
    leave: () => void;
};

const useTrajectoryPresence = (trajectoryId: string | undefined): UseTrajectoryPresenceResult => {
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const socket = useSocket();
    const joinedRef = useRef(false);

    const join = useCallback(() => {
        if(!trajectoryId || joinedRef.current) return;
        socket.emit('trajectory.presence.join', { trajectoryId });
        joinedRef.current = true;
    }, [trajectoryId, socket]);

    const leave = useCallback(() => {
        if(!trajectoryId || !joinedRef.current) return;
        socket.emit('trajectory.presence.leave', { trajectoryId });
        joinedRef.current = false;
    }, [trajectoryId, socket]);

    useSocketEvent<TrajectoryPresencePayload>('trajectory.presence.update', (data) => {
        if(data.trajectoryId === trajectoryId){
            setUsers(data.users);
        }
    }, { enabled: !!trajectoryId });

    useEffect(() => {
        setUsers([]);

        if(!trajectoryId){
            joinedRef.current = false;
        }
    }, [trajectoryId]);

    useEffect(() => {
        return () => {
            if(joinedRef.current && trajectoryId){
                socket.emit('trajectory.presence.leave', { trajectoryId });
                joinedRef.current = false;
            }
        };
    }, [trajectoryId, socket]);

    return { users, join, leave };
};

export default useTrajectoryPresence;
