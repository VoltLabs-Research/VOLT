import { useState } from 'react';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';

const useTeamPresence = () => {
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

    useSocketEvent<{ teamId: string; users: { _id: string }[] }>('user:list', (data) => {
        setOnlineUserIds(new Set(data.users.map((u) => u._id)));
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:online', (data) => {
        setOnlineUserIds((prev) => new Set(prev).add(data.userId));
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:offline', (data) => {
        setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
        });
    });

    return onlineUserIds;
};

export default useTeamPresence;
