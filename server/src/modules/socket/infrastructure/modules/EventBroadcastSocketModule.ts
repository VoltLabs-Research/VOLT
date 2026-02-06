import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';

/**
 * Generic Event Broadcasting Socket Module
 * 
 * Maps domain events to WebSocket events automatically without domain-specific knowledge.
 * Follows Clean Architecture by not coupling to specific modules.
 * 
 * Convention: Events with `teamId` in their data are broadcast to `team-{teamId}` rooms
 */
@singleton()
export default class EventBroadcastSocketModule extends BaseSocketModule {
    public readonly name = 'EventBroadcastSocketModule';

    // Events to broadcast to frontend - can be configured
    private readonly eventsToBroadcast = [
        'trajectory.updated'
    ];

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[EventBroadcastSocketModule] Starting initialization...');

        // Subscribe to all events that should be broadcast to frontend
        for (const eventName of this.eventsToBroadcast) {
            await this.eventBus.subscribe(eventName, this.createGenericBroadcastHandler());
        }

        logger.info(`[EventBroadcastSocketModule] Subscribed to ${this.eventsToBroadcast.length} events for broadcasting`);
    }

    /**
     * Generic handler that broadcasts any event to the appropriate socket room
     * Uses the event name directly as the socket event name
     */
    private createGenericBroadcastHandler(): IEventHandler<IDomainEvent> {
        return {
            handle: async (event: IDomainEvent) => {
                const eventData = (event as any).data;

                // Extract teamId from event data (convention)
                const teamId = eventData?.teamId;

                if (!teamId) {
                    logger.warn(`[EventBroadcastSocketModule] Event ${event.name} has no teamId, skipping broadcast`);
                    return;
                }

                const payload = {
                    ...eventData,
                    timestamp: new Date().toISOString(),
                    eventName: event.name
                };

                const roomName = `team-${teamId}`;
                logger.info(`[EventBroadcastSocketModule] Broadcasting ${event.name} to ${roomName}`);
                this.emitToRoom(roomName, event.name, payload);
            }
        };
    }

    onConnection(connection: ISocketConnection): void {
        logger.info(`[EventBroadcastSocketModule] Client connected: ${connection.id}`);

        // Handle team subscription
        this.on(connection.id, 'subscribe_to_team', async (conn, payload: { teamId: string, previousTeamId?: string }) => {
            logger.info(`[EventBroadcastSocketModule] Client ${conn.id} subscribing to team: ${payload.teamId}`);

            if (payload.previousTeamId) {
                await this.leaveRoom(conn.id, `team-${payload.previousTeamId}`);
                logger.info(`[EventBroadcastSocketModule] Client ${conn.id} left team-${payload.previousTeamId}`);
            }

            if (payload.teamId) {
                await this.joinRoom(conn.id, `team-${payload.teamId}`);
                logger.info(`[EventBroadcastSocketModule] Client ${conn.id} joined team-${payload.teamId}`);
            }
        });
    }
}
