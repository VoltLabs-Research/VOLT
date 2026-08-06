import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import logger from '@shared/infrastructure/logger';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

const BROADCAST_EVENTS = [
    'trajectory.created',
    'trajectory.deleted',
    'trajectory.updated',
    'analysis.created',
    'analysis.deleted',
    'analysis.status.changed',
    'analysis.stage.changed',
    'scene-artifact.upserted',
    'plugin.created',
    'plugin.deleted',
    'team.created',
    'team.deleted',
    'team-member.deleted',
    'team-role.created',
    'team-role.deleted',
    'team-role.updated',
    'secret-key.created',
    'secret-key.deleted',
    'container.created',
    'container.updated',
    'container.deleted',
    'notebook.deleted',
    'whiteboard.deleted'
];

class EventBroadcastSocketModule extends BaseSocketModule {
    public readonly name = 'EventBroadcastSocketModule';

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    async onInit(): Promise<void> {
        const handler = {
            handle: async (event: IDomainEvent<Record<string, unknown>>) => {
                const teamId = event.payload.teamId;

                if (!teamId) {
                    logger.warn(`[EventBroadcastSocketModule] Event ${event.name} has no teamId, skipping broadcast`);
                    return;
                }

                this.emitToRoom(`team:${teamId}`, event.name, {
                    ...event.payload,
                    timestamp: new Date().toISOString(),
                    eventName: event.name
                });
            }
        };

        for (const eventName of BROADCAST_EVENTS) {
            await eventBus.subscribe(eventName, handler);
        }

        logger.info(`[EventBroadcastSocketModule] Subscribed to ${BROADCAST_EVENTS.length} events for broadcasting`);
    }

    onConnection(_connection: ISocketConnection): void {}
}

const eventBroadcastSocketModule = new EventBroadcastSocketModule();

export default eventBroadcastSocketModule;
