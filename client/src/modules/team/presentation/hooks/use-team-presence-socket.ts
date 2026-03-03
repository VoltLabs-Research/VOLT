import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import { useTeamPresenceStore } from '../stores/use-team-presence-store';

const useTeamPresenceSocket = (): void => {
    const setOnlineUserIds = useTeamPresenceStore((s) => s.setOnlineUserIds);
    const addOnlineUser = useTeamPresenceStore((s) => s.addOnlineUser);
    const removeOnlineUser = useTeamPresenceStore((s) => s.removeOnlineUser);

    useSocketEvent<{ teamId: string; users: { _id: string }[] }>('user:list', (data) => {
        setOnlineUserIds(new Set(data.users.map((u) => u._id)));
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:online', (data) => {
        addOnlineUser(data.userId);
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:offline', (data) => {
        removeOnlineUser(data.userId);
    });
};

export default useTeamPresenceSocket;
