import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { inject, singleton } from 'tsyringe';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

type BroadcastableEvent = IDomainEvent<Record<string, unknown>>;

@singleton()
export default class EventBroadcastSocketModule extends BaseSocketModule {
    public readonly name = 'EventBroadcastSocketModule';

    private readonly eventsToBroadcast = [
        'trajectory.created',
        'trajectory.deleted',
        'trajectory.updated',
        'analysis.created',
        'analysis.deleted',
        'plugin.created',
        'plugin.deleted',
        'team.created',
        'team.deleted',
        'team-member.left',
        'team-member.created',
        'team-member.deleted',
        'team-role.created',
        'team-role.deleted',
        'team-role.updated',
        'secret-key.created',
        'secret-key.deleted',
        'ssh-connection.created',
        'ssh-connection.deleted',
        'container.created',
        'container.deleted',
        'notebook.deleted',
        'whiteboard.deleted'
    ];

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[EventBroadcastSocketModule] Starting initialization...');

        for (const eventName of this.eventsToBroadcast) {
            await this.eventBus.subscribe(eventName, this.createGenericBroadcastHandler());
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
};
