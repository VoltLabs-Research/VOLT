import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import logger from '@shared/infrastructure/logger';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

type BroadcastableEvent = IDomainEvent<Record<string, unknown>>;

class EventBroadcastSocketModule extends BaseSocketModule {
    public readonly name = 'EventBroadcastSocketModule';

    private readonly eventsToBroadcast = [
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

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[EventBroadcastSocketModule] Starting initialization...');

        const handler = this.createGenericBroadcastHandler();
        for (const eventName of this.eventsToBroadcast) {
            await eventBus.subscribe(eventName, handler);
        }

        logger.info(`[EventBroadcastSocketModule] Subscribed to ${this.eventsToBroadcast.length} events for broadcasting`);
    }

    onConnection(_connection: ISocketConnection): void {}

    private createGenericBroadcastHandler(): IEventHandler<BroadcastableEvent> {
        return {
            handle: async (event: BroadcastableEvent) => {
                const eventData = event.payload;
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

                this.emitToRoom(`team:${teamId}`, event.name, payload);
            }
        };
    }
}

const eventBroadcastSocketModule = new EventBroadcastSocketModule();

export default eventBroadcastSocketModule;
