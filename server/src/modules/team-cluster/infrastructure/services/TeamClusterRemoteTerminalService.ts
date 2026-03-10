import { ErrorCodes } from '@core/constants/error-codes';
import {
    TeamClusterRemoteAccessTargetDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import logger from '@shared/infrastructure/logger';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import type { ITerminalClient } from '@modules/container/domain/port/ITerminalService';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface AttachRemoteTerminalParams {
    sessionId: string;
    userId: string;
    teamIds: string[];
};

interface TerminalSession {
    attachment: ContainerTerminalAttachment;
    history: Buffer[];
    historySize: number;
    activeConnections: number;
    cleanupTimer: NodeJS.Timeout | null;
};

interface SocketTerminalHandlers {
    onInput: (input: string) => void;
    onResize: (size: { rows: number; cols: number; }) => void;
    onDisconnect: () => void;
};

@injectable()
export default class TeamClusterRemoteTerminalService {
    private readonly sessions = new Map<string, TerminalSession>();
    private readonly clientHandlers = new WeakMap<ITerminalClient, SocketTerminalHandlers>();
    private readonly historyLimitBytes = 10_000;

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService)
        private readonly sessionService: TeamClusterRemoteAccessSessionService
    ) {}

    async attach(client: ITerminalClient, params: AttachRemoteTerminalParams): Promise<void> {
        const sessionResult = this.sessionService.validateSession({
            sessionId: params.sessionId,
            userId: params.userId,
            target: TeamClusterRemoteAccessTargetDTO.HostTerminal
        });

        if (sessionResult instanceof Error) {
            this.emitError(client, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, sessionResult.message);
            return;
        }

        if (!params.teamIds.includes(sessionResult.teamId)) {
            this.emitError(client, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You are not allowed to access this cluster terminal');
            return;
        }

        client.joinRoom(params.sessionId);
        let session = this.sessions.get(params.sessionId);

        if (!session) {
            try {
                const attachment = await this.teamClusterDaemonClient.attachHostTerminal(sessionResult.teamClusterId);
                session = {
                    attachment,
                    history: [],
                    historySize: 0,
                    activeConnections: 0,
                    cleanupTimer: null
                };

                this.sessions.set(params.sessionId, session);

                attachment.stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf-8');
                    client.emitDataToRoom(params.sessionId, data);
                    if (!session) {
                        return;
                    }

                    session.history.push(chunk);
                    session.historySize += chunk.length;

                    while (session.historySize > this.historyLimitBytes && session.history.length > 0) {
                        const removedChunk = session.history.shift();
                        if (removedChunk) {
                            session.historySize -= removedChunk.length;
                        }
                    }
                });

                attachment.stream.on('end', () => this.cleanupSession(params.sessionId));
                attachment.stream.on('error', (error: Error) => {
                    this.emitErrorToRoom(client, params.sessionId, ErrorCodes.CONTAINER_EXEC_FAILED, error.message);
                    this.cleanupSession(params.sessionId);
                });
            } catch (error: unknown) {
                this.emitError(
                    client,
                    ErrorCodes.CONTAINER_EXEC_FAILED,
                    error instanceof Error ? error.message : 'Unexpected terminal error'
                );
                client.leaveRoom(params.sessionId);
                return;
            }
        }

        if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        session.activeConnections += 1;
        if (session.history.length > 0) {
            client.emitData(Buffer.concat(session.history).toString('utf-8'));
        }

        const onInput = (input: string) => {
            if (!session || session.attachment.stream.destroyed) {
                return;
            }

            session.attachment.stream.write(input);
        };

        const onResize = (size: { rows: number; cols: number; }) => {
            if (!session) {
                return;
            }

            session.attachment.exec.resize(size).catch((error: unknown) => {
                logger.warn({ err: error, sessionId: params.sessionId }, 'Failed to resize remote terminal');
            });
        };

        const onDisconnect = () => this.detach(client, params.sessionId);

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

    detach(client: ITerminalClient, sessionId: string): void {
        const handlers = this.clientHandlers.get(client);
        if (handlers) {
            client.offInput(handlers.onInput);
            client.offResize(handlers.onResize);
            client.offDetach(handlers.onDisconnect);
            client.offDisconnect(handlers.onDisconnect);
            this.clientHandlers.delete(client);
        }

        client.leaveRoom(sessionId);

        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.activeConnections -= 1;

        if (session.activeConnections <= 0) {
            session.activeConnections = 0;
            session.cleanupTimer = setTimeout(() => this.cleanupSession(sessionId), 5_000);
        }
    }

    private cleanupSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session || session.activeConnections > 0) {
            return;
        }

        try {
            session.attachment.stream.removeAllListeners();
            session.attachment.stream.destroy();
            session.history = [];
        } catch (error) {
            logger.error({ err: error, sessionId }, 'Error cleaning up remote terminal session');
        }

        this.sessions.delete(sessionId);
    }

    private emitError(client: ITerminalClient, code: string, details?: string): void {
        client.emitError({
            code,
            details
        });
    }

    private emitErrorToRoom(client: ITerminalClient, room: string, code: string, details?: string): void {
        client.emitErrorToRoom(room, {
            code,
            details
        });
    }
}
