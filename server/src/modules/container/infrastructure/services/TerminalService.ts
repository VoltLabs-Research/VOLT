import { ErrorCodes } from '@core/constants/error-codes';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { ContainerTerminalAttachment, IContainerService } from '@modules/container/domain/port/IContainerService';
import { ContainerTerminalError, ContainerTerminalResizePayload, ITerminalClient, ITerminalService } from '@modules/container/domain/port/ITerminalService';
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
    private readonly clientHandlers = new WeakMap<ITerminalClient, SocketTerminalHandlers>();

    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository
    ) {}

    async attach(client: ITerminalClient, containerId: string): Promise<void> {
        client.joinRoom(containerId);
        let session = this.sessions.get(containerId);

        if (!session) {
            try {
                const containerDoc = await this.repository.findById(containerId);
                if (!containerDoc || !containerDoc.containerId) {
                    this.emitError(client, ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found or not created');
                    return;
                }

                const attachment = await this.containerService.attachTerminal(containerDoc.containerId);
                session = {
                    attachment,
                    history: [],
                    historySize: 0,
                    activeConnections: 0,
                    cleanupTimer: null
                };

                this.sessions.set(containerId, session);

                attachment.stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf-8');
                    client.emitDataToRoom(containerId, data);
                    if (session) {
                        session.history.push(chunk);
                        session.historySize += chunk.length;
                        while (session.historySize > this.HISTORY_LIMIT_BYTES && session.history.length > 0) {
                            const removed = session.history.shift();
                            if (removed) session.historySize -= removed.length;
                        }
                    }
                });

                attachment.stream.on('end', () => this.cleanupSession(containerId));
                attachment.stream.on('error', (error: Error) => {
                    this.emitErrorToRoom(client, containerId, ErrorCodes.CONTAINER_EXEC_FAILED, this.getErrorDetails(error, 'Terminal stream error'));
                    this.cleanupSession(containerId);
                });

            } catch (error: unknown) {
                this.emitError(client, ErrorCodes.INTERNAL_SERVER_ERROR, this.getErrorDetails(error, 'Unexpected terminal error'));
                client.leaveRoom(containerId);
                return;
            }
        }

        if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        session.activeConnections++;
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

        const onDisconnect = () => this.detach(client, containerId);

        this.clientHandlers.set(client, {
            onInput,
            onResize,
            onDisconnect
        });

        client.onInput(onInput);
        client.onResize(onResize);
        client.onDetach(onDisconnect);
        client.onDisconnect(onDisconnect);
    }

    detach(client: ITerminalClient, containerId: string): void {
        const handlers = this.clientHandlers.get(client);
        if (handlers) {
            client.offInput(handlers.onInput);
            client.offResize(handlers.onResize);
            client.offDetach(handlers.onDisconnect);
            client.offDisconnect(handlers.onDisconnect);
            this.clientHandlers.delete(client);
        }
        client.leaveRoom(containerId);

        const session = this.sessions.get(containerId);
        if (!session) return;

        session.activeConnections--;
        if (session.activeConnections <= 0) {
            session.activeConnections = 0;
            session.cleanupTimer = setTimeout(() => this.cleanupSession(containerId), 5000);
        }
    }

    private cleanupSession(containerId: string) {
        const session = this.sessions.get(containerId);
        if (!session || session.activeConnections > 0) return;

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
