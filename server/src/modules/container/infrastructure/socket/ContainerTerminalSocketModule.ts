import { ErrorCodes } from '@core/constants/error-codes';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import type { ContainerTerminalAttachment, ContainerTerminalSize } from '@modules/container/domain/port/IContainerService';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

interface ContainerTerminalAttachPayload {
    containerId: string;
}

interface ContainerTerminalResizePayload {
    cols: number;
    rows: number;
}

interface ActiveTerminalSession {
    containerId: string;
    attachment: ContainerTerminalAttachment;
}

const CONTAINER_TERMINAL_EVENTS = {
    ATTACH: 'container:terminal:attach',
    DETACH: 'container:terminal:detach',
    DATA: 'container:terminal:data',
    INPUT: 'container:terminal:input',
    RESIZE: 'container:terminal:resize',
    ERROR: 'container:error'
} as const;

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class ContainerTerminalSocketModule extends BaseSocketModule {
    public readonly name = 'ContainerTerminalSocketModule';

    private readonly sessions = new Map<string, ActiveTerminalSession>();

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly containerRepository: ContainerRepository,
        private readonly containerRuntimeService: DaemonContainerRuntimeService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<ContainerTerminalAttachPayload>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.ATTACH,
            async (conn, payload) => {
                await this.handleAttach(conn, payload);
            }
        );

        this.on<unknown>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.DETACH,
            async (conn) => {
                this.destroySession(conn.id);
            }
        );

        this.on<string>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.INPUT,
            async (conn, data) => {
                const session = this.sessions.get(conn.id);
                if (!session || session.attachment.stream.destroyed) {
                    return;
                }

                if (typeof data === 'string') {
                    session.attachment.stream.write(data);
                }
            }
        );

        this.on<ContainerTerminalResizePayload>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.RESIZE,
            async (conn, payload) => {
                const session = this.sessions.get(conn.id);
                if (!session) {
                    return;
                }

                const size = this.parseResizePayload(payload);
                if (size) {
                    await session.attachment.exec.resize(size);
                }
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            this.destroySession(conn.id);
        });
    }

    private async handleAttach(conn: ISocketConnection, payload: ContainerTerminalAttachPayload): Promise<void> {
        if (!payload?.containerId || typeof payload.containerId !== 'string') {
            this.emitTerminalError(conn.id, 'INVALID_PAYLOAD', 'containerId is required');
            return;
        }

        this.destroySession(conn.id);

        const container = await this.containerRepository.findById(payload.containerId);
        if (!container) {
            this.emitTerminalError(conn.id, 'CONTAINER_NOT_FOUND', 'Container not found');
            return;
        }

        const userTeams = new Set(conn.user?.teams ?? []);
        if (!container.team || !userTeams.has(container.team)) {
            this.emitTerminalError(conn.id, ErrorCodes.TEAM_ACCESS_DENIED, 'You do not have access to this container');
            return;
        }

        if (!container.teamCluster) {
            this.emitTerminalError(conn.id, 'NO_CLUSTER', 'Container is not assigned to a cluster');
            return;
        }

        try {
            const attachment = await this.containerRuntimeService.attachTerminal(
                container.teamCluster,
                container.containerId
            );

            this.sessions.set(conn.id, {
                containerId: payload.containerId,
                attachment
            });

            attachment.stream.on('data', (chunk: Buffer) => {
                this.emitToSocket(conn.id, CONTAINER_TERMINAL_EVENTS.DATA, chunk.toString('utf8'));
            });

            attachment.stream.on('end', () => {
                this.sessions.delete(conn.id);
            });

            attachment.stream.on('error', (error: Error) => {
                this.emitTerminalError(conn.id, 'STREAM_ERROR', error.message);
                this.sessions.delete(conn.id);
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to attach terminal';
            logger.warn(`[ContainerTerminalSocket] Attach failed containerId=${payload.containerId} socketId=${conn.id} error=${message}`);
            this.emitTerminalError(conn.id, 'ATTACH_FAILED', message);
        }
    }

    private destroySession(socketId: string): void {
        const session = this.sessions.get(socketId);
        if (!session) {
            return;
        }

        session.attachment.stream.removeAllListeners();
        session.attachment.stream.destroy();
        this.sessions.delete(socketId);
    }

    private emitTerminalError(socketId: string, code: string, message: string): void {
        this.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.ERROR, {
            code,
            message
        });
    }

    private parseResizePayload(payload: unknown): ContainerTerminalSize | null {
        if (typeof payload !== 'object' || payload === null) {
            return null;
        }

        const { rows, cols } = payload as Record<string, unknown>;
        if (typeof rows !== 'number' || typeof cols !== 'number') {
            return null;
        }

        if (rows < 1 || cols < 1 || rows > 500 || cols > 500) {
            return null;
        }

        return { rows, cols };
    }
}
