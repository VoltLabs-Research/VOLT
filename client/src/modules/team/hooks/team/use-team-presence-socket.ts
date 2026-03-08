import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/api/entities/socket-constants';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/use-team-presence-store';

const useTeamPresenceSocket = (): void => {
    const teamId = useSelectedTeamId();
    const setPresenceSnapshot = useTeamPresenceStore((s) => s.setPresenceSnapshot);
    const addOnlineUser = useTeamPresenceStore((s) => s.addOnlineUser);
    const removeOnlineUser = useTeamPresenceStore((s) => s.removeOnlineUser);

    useSocketEvent<{ teamId: string; users: { _id: string }[] }>(SOCKET_TEAM_EVENTS.PRESENCE_SNAPSHOT, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        setPresenceSnapshot(data.users.map((u) => u._id));
    });

    useSocketEvent<{ teamId: string; userId: string }>(SOCKET_TEAM_EVENTS.USER_ONLINE, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        addOnlineUser(data.userId);
    });

    useSocketEvent<{ teamId: string; userId: string }>(SOCKET_TEAM_EVENTS.USER_OFFLINE, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        removeOnlineUser(data.userId);
    });
};

export default useTeamPresenceSocket;
