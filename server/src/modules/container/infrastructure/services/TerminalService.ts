import { ErrorCodes } from '@core/constants/error-codes';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { ContainerTerminalAttachContext, ContainerTerminalError, ContainerTerminalResizePayload, ITerminalClient, ITerminalService } from '@modules/container/domain/port/ITerminalService';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

interface SocketTerminalHandlers {
    onInput: (input: string) => void;
    onResize: (size: ContainerTerminalResizePayload) => void;
    onDisconnect: () => void;
};

interface TerminalSession {
    attachment: ContainerTerminalAttachment;
    history: Buffer[];
    historySize: number;
    activeConnections: number;
    cleanupTimer: NodeJS.Timeout | null;
};

@injectable()
export class TerminalService implements ITerminalService {
    private sessions: Map<string, TerminalSession> = new Map();
    private readonly HISTORY_LIMIT_BYTES = 10000;
    private readonly IDLE_TIMEOUT_MS = 5000;
    private readonly clientHandlers = new WeakMap<ITerminalClient, SocketTerminalHandlers>();
    private readonly clientSessions = new WeakMap<ITerminalClient, string>();
    private readonly clientContexts = new WeakMap<ITerminalClient, ContainerTerminalAttachContext>();

    constructor(
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(ContainerOwnershipService)
        private readonly ownershipService: ContainerOwnershipService
    ) {}

    async attach(client: ITerminalClient, context: ContainerTerminalAttachContext): Promise<void> {
        const previousContainerId = this.clientSessions.get(client);
        if (previousContainerId) {
            this.detach(client, previousContainerId);
        } else {
            this.removeClientHandlers(client);
        }

        try {
            const container = await this.ownershipService.getOwnedByTeam(context.containerId, context.teamId);
            if (!container.containerId) {
                this.emitError(client, ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found or not created');
                return;
            }

            if (!container.teamCluster) {
                this.emitError(client, ErrorCodes.CONTAINER_NOT_FOUND, 'Container is not assigned to a team cluster');
                return;
            }

            client.joinRoom(context.containerId);
            let session = this.sessions.get(context.containerId);

            if (!session) {
                const attachment = await this.containerRuntimeService.attachTerminal(container.teamCluster, container.containerId);
                session = {
                    attachment,
                    history: [],
                    historySize: 0,
                    activeConnections: 0,
                    cleanupTimer: null
                };

                this.sessions.set(context.containerId, session);

                attachment.stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf-8');
                    client.emitDataToRoom(context.containerId, data);
                    if (session) {
                        session.history.push(chunk);
                        session.historySize += chunk.length;
                        while (session.historySize > this.HISTORY_LIMIT_BYTES && session.history.length > 0) {
                            const removed = session.history.shift();
                            if (removed) session.historySize -= removed.length;
                        }
                    }
                });

                attachment.stream.on('end', () => this.cleanupSession(context.containerId));
                attachment.stream.on('error', (error: Error) => {
                    this.emitErrorToRoom(client, context.containerId, ErrorCodes.CONTAINER_EXEC_FAILED, this.getErrorDetails(error, 'Terminal stream error'));
                    this.cleanupSession(context.containerId);
                });
            }

            if (!session) {
                client.leaveRoom(context.containerId);
                return;
            }

            if (session.cleanupTimer) {
                clearTimeout(session.cleanupTimer);
                session.cleanupTimer = null;
            }

            session.activeConnections++;
            this.clientSessions.set(client, context.containerId);
            this.clientContexts.set(client, context);

            logger.info(`@container-terminal containerId=${context.containerId} teamId=${context.teamId} userId=${context.userId} socketId=${client.id}`);

            if (session.history.length > 0) {
                const combined = Buffer.concat(session.history).toString('utf8');
                client.emitData(combined);
            }

            const onInput = (input: string) => {
                if (session && !session.attachment.stream.destroyed) {
                    session.attachment.stream.write(input);
                }
            };

            const onResize = (size: ContainerTerminalResizePayload) => {
                if (session) {
                    session.attachment.exec.resize(size).catch(() => { });
                }
            };

            const onDisconnect = () => this.detach(client, context.containerId);

            this.clientHandlers.set(client, {
                onInput,
                onResize,
                onDisconnect
            });

            client.onInput(onInput);
            client.onResize(onResize);
            client.onDetach(onDisconnect);
            client.onDisconnect(onDisconnect);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                this.emitError(client, error.code, error.message);
            } else {
                this.emitError(client, ErrorCodes.INTERNAL_SERVER_ERROR, this.getErrorDetails(error, 'Unexpected terminal error'));
            }

            client.leaveRoom(context.containerId);
        }
    }

    detach(client: ITerminalClient, containerId: string): void {
        this.removeClientHandlers(client);
        this.clientSessions.delete(client);
        const context = this.clientContexts.get(client);
        this.clientContexts.delete(client);
        client.leaveRoom(containerId);

        const session = this.sessions.get(containerId);
        if (!session) return;

        session.activeConnections--;

        logger.info(`@container-terminal containerId=${containerId} teamId=${context?.teamId} userId=${context?.userId} socketId=${client.id}`);

        if (session.activeConnections <= 0) {
            session.activeConnections = 0;
            session.cleanupTimer = setTimeout(() => this.cleanupSession(containerId), this.IDLE_TIMEOUT_MS);
        }
    }

    /**
     * Removes event listeners for a client and clears its handler entry.
     * Safe to call even when no handlers are registered.
     */
    private removeClientHandlers(client: ITerminalClient): void {
        const handlers = this.clientHandlers.get(client);
        if (!handlers) return;

        client.offInput(handlers.onInput);
        client.offResize(handlers.onResize);
        client.offDetach(handlers.onDisconnect);
        client.offDisconnect(handlers.onDisconnect);
        this.clientHandlers.delete(client);
    }

    private cleanupSession(containerId: string) {
        const session = this.sessions.get(containerId);
        if (!session || session.activeConnections > 0) return;

        if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        try {
            session.attachment.stream.removeAllListeners();
            session.attachment.stream.destroy();
            session.history = [];
        } catch (e) {
            logger.error(`Error cleaning up session ${containerId}: ${e}`);
        }
        this.sessions.delete(containerId);
    }

    private emitError(client: ITerminalClient, code: string, details?: string): void {
        client.emitError(this.createTerminalError(code, details));
    }

    private emitErrorToRoom(client: ITerminalClient, room: string, code: string, details?: string): void {
        client.emitErrorToRoom(room, this.createTerminalError(code, details));
    }

    private createTerminalError(code: string, details?: string): ContainerTerminalError {
        return { code, details };
    }

    private getErrorDetails(error: unknown, fallbackMessage: string): string {
        if (error instanceof Error && error.message) {
            return error.message;
        }

        if (typeof error === 'string' && error.length > 0) {
            return error;
        }

        return fallbackMessage;
    }
};
