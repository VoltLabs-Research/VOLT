import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export interface TeamPresenceCallbacks {
    onUserOnline: (userId: string) => void;
    onUserOffline: (userId: string) => void;
    onPresenceList: (userIds: string[]) => void;
}

export interface TeamPresenceSubscriptions {
    offUserOnline: () => void;
    offUserOffline: () => void;
    offPresenceList: () => void;
}

export class InitializeTeamPresenceSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(teamId: string, callbacks: TeamPresenceCallbacks): TeamPresenceSubscriptions {
        const offUserOnline = this.socketService.on('user:online', (payload: { teamId: string; userId: string }) => {
            if (payload.teamId !== teamId) return;
            callbacks.onUserOnline(payload.userId);
        });

        const offUserOffline = this.socketService.on('user:offline', (payload: { teamId: string; userId: string }) => {
            if (payload.teamId !== teamId) return;
            callbacks.onUserOffline(payload.userId);
        });

        const offPresenceList = this.socketService.on('user:list', (payload: { teamId: string; users: { _id: string }[] }) => {
            if (payload.teamId !== teamId) return;
            callbacks.onPresenceList(payload.users.map((user) => user._id));
        });

        return {
            offUserOnline,
            offUserOffline,
            offPresenceList
        };
    }
}
