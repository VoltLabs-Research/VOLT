import { SOCKET_TEAM_EVENTS } from '../events/team';
import socketService from './socket-service';
import { emitOrSwallow, emitWithReport } from './socket-emit-helpers';
import type { ISocketService } from './contracts/socket-service';
import type { ITeamSocketRoomService } from './contracts/team-room-service';

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

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

        if (this.isCurrentlySubscribed(teamId) && isSameTeam && !resolvedPreviousTeamId) {
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

        emitOrSwallow(SOCKET_TEAM_EVENTS.LEAVE, { teamId: targetTeamId });
    }

    getCurrentTeamId(): string | null {
        return this.currentTeamId;
    }

    async waitUntilSubscribed(teamId: string): Promise<void> {
        if (this.isCurrentlySubscribed(teamId)) {
            return;
        }

        await this.subscribe(teamId);

        if (!this.isCurrentlySubscribed(teamId)) {
            throw new Error(`Team socket subscription unavailable for team "${teamId}".`);
        }
    }

    private isCurrentlySubscribed(teamId: string): boolean {
        return this.subscribedTeamId === teamId && this.socketService.isConnected();
    }

    private async subscribeToTeam(teamId: string, previousTeamId?: string): Promise<void> {
        try {
            if (!this.socketService.isConnected()) {
                await this.socketService.connect();
            }

            if (!this.socketService.isConnected()) {
                return;
            }

            const ack = await emitWithReport<SocketAck>(SOCKET_TEAM_EVENTS.SUBSCRIBE, {
                teamId,
                previousTeamId
            });
            if (!ack?.ok) {
                throw new Error(ack?.error || `Failed to subscribe socket to team "${teamId}".`);
            }

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

const teamSocketRoomService = new TeamSocketRoomService(socketService);

export default teamSocketRoomService;
