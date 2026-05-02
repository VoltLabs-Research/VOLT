import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';

interface TeamPresenceSnapshotUser {
    _id: string;
}

interface TeamPresenceSnapshotEvent {
    teamId: string;
    users: TeamPresenceSnapshotUser[];
}

interface TeamPresenceUserEvent {
    teamId: string;
    userId: string;
}

export default function useTeamPresenceSocket(): void {
    const teamId = useSelectedTeamId();
    const setPresenceSnapshot = useTeamPresenceStore((s) => s.setPresenceSnapshot);
    const addOnlineUser = useTeamPresenceStore((s) => s.addOnlineUser);
    const removeOnlineUser = useTeamPresenceStore((s) => s.removeOnlineUser);

    useSocketEvent<TeamPresenceSnapshotEvent>(SOCKET_TEAM_EVENTS.PRESENCE_SNAPSHOT, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        setPresenceSnapshot(data.users.map((u) => u._id));
    });

    useSocketEvent<TeamPresenceUserEvent>(SOCKET_TEAM_EVENTS.USER_ONLINE, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        addOnlineUser(data.userId);
    });

    useSocketEvent<TeamPresenceUserEvent>(SOCKET_TEAM_EVENTS.USER_OFFLINE, (data) => {
        if (!teamId || data.teamId !== teamId) {
            return;
        }

        removeOnlineUser(data.userId);
    });
}
