import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import { useTeamPresenceStore } from '../stores/use-team-presence-store';

const useTeamPresenceSocket = (): void => {
    const teamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const setPresenceSnapshot = useTeamPresenceStore((s) => s.setPresenceSnapshot);
    const addOnlineUser = useTeamPresenceStore((s) => s.addOnlineUser);
    const removeOnlineUser = useTeamPresenceStore((s) => s.removeOnlineUser);

    useSocketEvent<{ teamId: string; users: { _id: string }[] }>('user:list', (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        setPresenceSnapshot(data.users.map((u) => u._id));
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:online', (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        addOnlineUser(data.userId);
    });

    useSocketEvent<{ teamId: string; userId: string }>('user:offline', (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        removeOnlineUser(data.userId);
    });
};

export default useTeamPresenceSocket;
