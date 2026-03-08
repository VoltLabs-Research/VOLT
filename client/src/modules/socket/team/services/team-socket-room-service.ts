import { SOCKET_TEAM_EVENTS } from '../constants/team-socket-events';
import socketService from '../../core/services/socket-service';
import type { ISocketService } from '../../core/services/contracts/socket-service';
import type { ITeamSocketRoomService } from './contracts/team-socket-room-service';

class TeamSocketRoomService implements ITeamSocketRoomService {
    private currentTeamId: string | null = null;

    constructor(private readonly socketService: ISocketService) {
        this.socketService.onConnectionChange((connected) => {
            if (!connected || !this.currentTeamId) {
                return;
            }

            this.socketService.emit(SOCKET_TEAM_EVENTS.SUBSCRIBE, { teamId: this.currentTeamId }).catch(() => undefined);
        });
    }

    async subscribe(teamId: string, previousTeamId?: string): Promise<void> {
        let resolvedPreviousTeamId = previousTeamId;
        if (!resolvedPreviousTeamId && this.currentTeamId && this.currentTeamId !== teamId) {
            resolvedPreviousTeamId = this.currentTeamId;
        }

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

        this.socketService.emit(SOCKET_TEAM_EVENTS.LEAVE, { teamId: targetTeamId }).catch(() => undefined);
    }

    getCurrentTeamId(): string | null {
        return this.currentTeamId;
    }
}

export const teamSocketRoomService = new TeamSocketRoomService(socketService);

export default teamSocketRoomService;
