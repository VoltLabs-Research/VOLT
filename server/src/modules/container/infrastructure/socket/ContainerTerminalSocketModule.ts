import { ErrorCodes } from '@core/constants/error-codes';
import type { ContainerTerminalAttachment, ContainerTerminalSize } from '@modules/container/domain/port/IContainerService';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
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

interface SharedTerminalSession {
    readonly attachment: ContainerTerminalAttachment;
    readonly containerKey: string;
    readonly onData: (chunk: Buffer) => void;
    readonly onEnd: () => void;
    readonly onError: (error: Error) => void;
    readonly participants: Set<string>;
    readonly runtimeContainerId: string;
    readonly teamClusterId: string;
    readonly transcriptChunks: string[];
    closing: boolean;
    currentSize: ContainerTerminalSize | null;
    operationChain: Promise<void>;
}

const CONTAINER_TERMINAL_EVENTS = {
    ATTACH: 'container:terminal:attach',
    DETACH: 'container:terminal:detach',
    DATA: 'container:terminal:data',
    INPUT: 'container:terminal:input',
    RESIZE: 'container:terminal:resize',
    SIZE: 'container:terminal:size',
    ERROR: 'container:error'
} as const;

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class ContainerTerminalSocketModule extends BaseSocketModule {
    public readonly name = 'ContainerTerminalSocketModule';

    private readonly nextAttachTokenSeed = { value: 0 };
    private readonly pendingAttachTokens = new Map<string, number>();
    private readonly pendingResizeBySocketId = new Map<string, ContainerTerminalSize>();
    private readonly pendingSessionsByContainerKey = new Map<string, Promise<SharedTerminalSession>>();
    private readonly sharedSessionsByContainerKey = new Map<string, SharedTerminalSession>();
    private readonly socketMemberships = new Map<string, string>();

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
                await this.cleanupSocket(conn.id);
            }
        );

        this.on<string>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.INPUT,
            async (conn, data) => {
                const session = this.getSessionBySocketId(conn.id);
                if (!session || session.closing || session.attachment.stream.destroyed) {
                    return;
                }

                session.attachment.stream.write(data);
            }
        );

        this.on<ContainerTerminalResizePayload>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.RESIZE,
            async (conn, payload) => {
                const size = this.parseResizePayload(payload);
                if (!size) {
                    return;
                }

                const session = this.getSessionBySocketId(conn.id);
                if (!session || session.closing) {
                    this.pendingResizeBySocketId.set(conn.id, size);
                    return;
                }

                await this.applySharedSize(session, size);
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            await this.cleanupSocket(conn.id);
        });
    }

    private async handleAttach(conn: ISocketConnection, payload: ContainerTerminalAttachPayload): Promise<void> {
        if (!payload?.containerId) {
            this.emitTerminalError(conn.id, 'INVALID_PAYLOAD', 'containerId is required');
            return;
        }

        await this.cleanupSocket(conn.id);

        const attachToken = this.nextAttachToken();
        this.pendingAttachTokens.set(conn.id, attachToken);

        try {
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

            const containerKey = this.buildContainerKey(container.teamCluster, container.containerId);
            const session = await this.getOrCreateSharedSession(containerKey, container.teamCluster, container.containerId);

            if (this.pendingAttachTokens.get(conn.id) !== attachToken || session.closing) {
                await this.teardownSharedSessionIfUnused(containerKey);
                return;
            }

            this.socketMemberships.set(conn.id, containerKey);
            await this.addSocketToSession(session, conn.id);

            if (
                this.pendingAttachTokens.get(conn.id) !== attachToken
                || this.socketMemberships.get(conn.id) !== containerKey
                || session.closing
            ) {
                await this.cleanupSocket(conn.id);
                return;
            }

            this.pendingAttachTokens.delete(conn.id);

            const pendingSize = this.pendingResizeBySocketId.get(conn.id);
            if (pendingSize) {
                this.pendingResizeBySocketId.delete(conn.id);
                await this.applySharedSize(session, pendingSize);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to attach terminal';
            logger.warn(`[ContainerTerminalSocket] Attach failed containerId=${payload.containerId} socketId=${conn.id} error=${message}`);
            this.emitTerminalError(conn.id, 'ATTACH_FAILED', message);
        } finally {
            this.pendingAttachTokens.delete(conn.id);
        }
    }

    private async addSocketToSession(session: SharedTerminalSession, socketId: string): Promise<void> {
        await this.runSessionTask(session, async () => {
            if (session.closing) {
                return;
            }

            const transcript = session.transcriptChunks.join('');
            const size = session.currentSize;

            if (size) {
                this.emitTerminalSize(socketId, size);
            }

            if (transcript.length > 0) {
                this.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.DATA, transcript);
            }

            session.participants.add(socketId);
        });
    }

    private async applySharedSize(session: SharedTerminalSession, size: ContainerTerminalSize): Promise<void> {
        await this.runSessionTask(session, async () => {
            if (session.closing) {
                return;
            }

            try {
                await session.attachment.exec.resize(size);
            } catch (error) {
                logger.warn(
                    `[ContainerTerminalSocket] Resize failed containerKey=${session.containerKey} rows=${size.rows} cols=${size.cols} error=${error instanceof Error ? error.message : String(error)}`
                );
                return;
            }

            session.currentSize = size;

            for (const participantSocketId of session.participants) {
                this.emitTerminalSize(participantSocketId, size);
            }
        });
    }

    private async cleanupSocket(socketId: string): Promise<void> {
        this.pendingAttachTokens.delete(socketId);
        this.pendingResizeBySocketId.delete(socketId);

        const containerKey = this.socketMemberships.get(socketId);
        if (!containerKey) {
            return;
        }

        this.socketMemberships.delete(socketId);
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session) {
            return;
        }

        await this.runSessionTask(session, async () => {
            session.participants.delete(socketId);
        });

        await this.teardownSharedSessionIfUnused(containerKey);
    }

    private async getOrCreateSharedSession(
        containerKey: string,
        teamClusterId: string,
        runtimeContainerId: string
    ): Promise<SharedTerminalSession> {
        const existingSession = this.sharedSessionsByContainerKey.get(containerKey);
        if (existingSession) {
            return existingSession;
        }

        const pendingSession = this.pendingSessionsByContainerKey.get(containerKey);
        if (pendingSession) {
            return pendingSession;
        }

        const sessionPromise = this.containerRuntimeService.attachTerminal(teamClusterId, runtimeContainerId)
            .then((attachment) => {
                const session = this.createSharedSession(containerKey, teamClusterId, runtimeContainerId, attachment);
                this.sharedSessionsByContainerKey.set(containerKey, session);
                return session;
            })
            .finally(() => {
                this.pendingSessionsByContainerKey.delete(containerKey);
            });

        this.pendingSessionsByContainerKey.set(containerKey, sessionPromise);
        return sessionPromise;
    }

    private createSharedSession(
        containerKey: string,
        teamClusterId: string,
        runtimeContainerId: string,
        attachment: ContainerTerminalAttachment
    ): SharedTerminalSession {
        const session: SharedTerminalSession = {
            attachment,
            containerKey,
            runtimeContainerId,
            teamClusterId,
            participants: new Set<string>(),
            transcriptChunks: [],
            currentSize: null,
            operationChain: Promise.resolve(),
            closing: false,
            onData: (chunk: Buffer) => {
                const data = chunk.toString('utf8');
                session.transcriptChunks.push(data);

                for (const participantSocketId of session.participants) {
                    this.emitToSocket(participantSocketId, CONTAINER_TERMINAL_EVENTS.DATA, data);
                }
            },
            onEnd: () => {
                this.handleSessionTermination(session.containerKey);
            },
            onError: (error: Error) => {
                this.handleSessionTermination(session.containerKey, error);
            }
        };

        attachment.stream.on('data', session.onData);
        attachment.stream.on('end', session.onEnd);
        attachment.stream.on('error', session.onError);

        return session;
    }

    private async teardownSharedSessionIfUnused(containerKey: string): Promise<void> {
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session) {
            return;
        }

        await this.runSessionTask(session, async () => {
            if (session.participants.size > 0 || session.closing) {
                return;
            }

            await this.closeSharedSession(session);
        });
    }

    private handleSessionTermination(containerKey: string, error?: Error): void {
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session || session.closing) {
            return;
        }

        void this.runSessionTask(session, async () => {
            await this.closeSharedSession(session, error);
        }).catch((closeError) => {
            logger.warn(
                `[ContainerTerminalSocket] Session close failed containerKey=${containerKey} error=${closeError instanceof Error ? closeError.message : String(closeError)}`
            );
        });
    }

    private async closeSharedSession(session: SharedTerminalSession, error?: Error): Promise<void> {
        if (session.closing) {
            return;
        }

        session.closing = true;
        this.sharedSessionsByContainerKey.delete(session.containerKey);
        session.attachment.stream.removeAllListeners();

        const participantSocketIds = Array.from(session.participants);
        session.participants.clear();
        session.transcriptChunks.length = 0;
        session.currentSize = null;

        for (const participantSocketId of participantSocketIds) {
            if (this.socketMemberships.get(participantSocketId) === session.containerKey) {
                this.socketMemberships.delete(participantSocketId);
            }

            if (error) {
                this.emitTerminalError(participantSocketId, 'STREAM_ERROR', error.message);
            }
        }

        try {
            await session.attachment.close();
        } catch (closeError) {
            logger.warn(
                `[ContainerTerminalSocket] Terminal close failed containerKey=${session.containerKey} error=${closeError instanceof Error ? closeError.message : String(closeError)}`
            );
        }
    }

    private getSessionBySocketId(socketId: string): SharedTerminalSession | null {
        const containerKey = this.socketMemberships.get(socketId);
        if (!containerKey) {
            return null;
        }

        return this.sharedSessionsByContainerKey.get(containerKey) ?? null;
    }

    private emitTerminalError(socketId: string, code: string, message: string): void {
        this.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.ERROR, {
            code,
            message
        });
    }

    private emitTerminalSize(socketId: string, size: ContainerTerminalSize): void {
        this.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.SIZE, size);
    }

    private buildContainerKey(teamClusterId: string, runtimeContainerId: string): string {
        return `${teamClusterId}:${runtimeContainerId}`;
    }

    private nextAttachToken(): number {
        this.nextAttachTokenSeed.value += 1;
        return this.nextAttachTokenSeed.value;
    }

    private async runSessionTask<T>(session: SharedTerminalSession, task: () => Promise<T> | T): Promise<T> {
        const previousOperation = session.operationChain.catch(() => undefined);
        let releaseOperation: () => void = () => undefined;
        session.operationChain = new Promise<void>((resolve) => {
            releaseOperation = resolve;
        });

        await previousOperation;

        try {
            return await task();
        } finally {
            releaseOperation();
        }
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
