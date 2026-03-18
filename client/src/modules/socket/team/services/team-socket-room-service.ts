import { SOCKET_TEAM_EVENTS } from '../constants/team-socket-events';
import socketService from '../../core/services/socket-service';
import type { ISocketService } from '../../core/services/contracts/socket-service';
import type { ITeamSocketRoomService } from './contracts/team-socket-room-service';

class TeamSocketRoomService implements ITeamSocketRoomService {
    private currentTeamId: string | null = null;
    private subscribedTeamId: string | null = null;
    private pendingSubscriptionPromise: Promise<void> | null = null;
    private pendingSubscriptionTeamId: string | null = null;

    constructor(private readonly socketService: ISocketService) {
        this.socketService.onConnectionChange((connected) => {
            if (!connected) {
                this.subscribedTeamId = null;
                return;
            }

            if (!this.currentTeamId) {
                return;
            }

            this.subscribe(this.currentTeamId).catch(() => undefined);
        });
    }

    async subscribe(teamId: string, previousTeamId?: string): Promise<void> {
        let resolvedPreviousTeamId = previousTeamId;
        if (!resolvedPreviousTeamId && this.currentTeamId && this.currentTeamId !== teamId) {
            resolvedPreviousTeamId = this.currentTeamId;
        }

        const isSameTeam = this.currentTeamId === teamId;

        this.currentTeamId = teamId;

        if (this.isSubscribed(teamId) && isSameTeam && !resolvedPreviousTeamId) {
            return;
        }

        if (this.pendingSubscriptionPromise && this.pendingSubscriptionTeamId === teamId && isSameTeam) {
            return this.pendingSubscriptionPromise;
        }

        if (this.subscribedTeamId !== teamId) {
            this.subscribedTeamId = null;
        }

        const subscribePromise = this.subscribeToTeam(teamId, resolvedPreviousTeamId);
        this.pendingSubscriptionPromise = subscribePromise;
        this.pendingSubscriptionTeamId = teamId;

        return subscribePromise;
    }

    unsubscribe(teamId?: string): void {
        const targetTeamId = teamId ?? this.currentTeamId;

        if (targetTeamId === this.currentTeamId) {
            this.currentTeamId = null;
        }

        if (targetTeamId === this.subscribedTeamId) {
            this.subscribedTeamId = null;
        }

        if (targetTeamId === this.pendingSubscriptionTeamId) {
            this.pendingSubscriptionTeamId = null;
            this.pendingSubscriptionPromise = null;
        }

        if (!targetTeamId || !this.socketService.isConnected()) {
            return;
        }

        this.socketService.emit(SOCKET_TEAM_EVENTS.LEAVE, { teamId: targetTeamId }).catch(() => undefined);
    }

    getCurrentTeamId(): string | null {
        return this.currentTeamId;
    }

    isSubscribed(teamId: string): boolean {
        return this.subscribedTeamId === teamId && this.socketService.isConnected();
    }

    async waitUntilSubscribed(teamId: string): Promise<void> {
        if (this.isSubscribed(teamId)) {
            return;
        }

        await this.subscribe(teamId);

        if (!this.isSubscribed(teamId)) {
            throw new Error(`Team socket subscription unavailable for team "${teamId}".`);
        }
    }

    private async subscribeToTeam(teamId: string, previousTeamId?: string): Promise<void> {
        try {
            if (!this.socketService.isConnected()) {
                await this.socketService.connect();
            }

            if (!this.socketService.isConnected()) {
                return;
            }

            await this.socketService.emit(SOCKET_TEAM_EVENTS.SUBSCRIBE, {
                teamId,
                previousTeamId
            });

            if (this.currentTeamId === teamId) {
                this.subscribedTeamId = teamId;
            }
        } finally {
            if (this.pendingSubscriptionTeamId === teamId) {
                this.pendingSubscriptionTeamId = null;
                this.pendingSubscriptionPromise = null;
            }
        }
    }
};

export const teamSocketRoomService = new TeamSocketRoomService(socketService);

export default teamSocketRoomService;
