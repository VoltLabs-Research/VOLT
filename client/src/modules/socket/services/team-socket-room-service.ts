import type { ISocketService, ITeamSocketRoomService } from '../api/entities/socket-service';
import { SOCKET_TEAM_EVENTS } from '../api/entities/socket-constants';
import socketService from './socket-service';

class TeamSocketRoomService implements ITeamSocketRoomService {
    private currentTeamId: string | null = null;

    constructor(private readonly socketService: ISocketService) {
        this.socketService.onConnectionChange((connected) => {
            if (!connected || !this.currentTeamId) {
                return;
            }

            void this.socketService.emit(SOCKET_TEAM_EVENTS.SUBSCRIBE, { teamId: this.currentTeamId }).catch(() => undefined);
        });
    }

    async subscribe(teamId: string, previousTeamId?: string): Promise<void> {
        const resolvedPreviousTeamId = previousTeamId ?? (
            this.currentTeamId && this.currentTeamId !== teamId
                ? this.currentTeamId
                : undefined
        );
        const isSameTeam = this.currentTeamId === teamId;

        this.currentTeamId = teamId;

        if (isSameTeam && !resolvedPreviousTeamId && this.socketService.isConnected()) {
            return;
        }

        if (!this.socketService.isConnected()) {
            await this.socketService.connect();
        }

        if (!this.socketService.isConnected()) {
            return;
        }

        await this.socketService.emit(SOCKET_TEAM_EVENTS.SUBSCRIBE, {
            teamId,
            previousTeamId: resolvedPreviousTeamId
        });
    }

    unsubscribe(teamId?: string): void {
        const targetTeamId = teamId ?? this.currentTeamId;

        if (targetTeamId === this.currentTeamId) {
            this.currentTeamId = null;
        }

        if (!targetTeamId || !this.socketService.isConnected()) {
            return;
        }

        void this.socketService.emit(SOCKET_TEAM_EVENTS.LEAVE, { teamId: targetTeamId }).catch(() => undefined);
    }

    getCurrentTeamId(): string | null {
        return this.currentTeamId;
    }
}

const teamSocketRoomService = new TeamSocketRoomService(socketService);

export { teamSocketRoomService };
export default teamSocketRoomService;
