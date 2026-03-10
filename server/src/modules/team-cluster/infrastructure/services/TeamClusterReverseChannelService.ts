import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionKind,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionDetachPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSessionInputPayload,
    type TeamClusterDaemonSessionResizePayload,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import { inject, injectable } from 'tsyringe';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type {
    ContainerTerminalAttachment,
    ContainerTerminalExec,
    ContainerTerminalSize,
    ContainerTerminalStream
} from '@modules/container/domain/port/IContainerService';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

interface TeamClusterDaemonCommandPayload {
    command: string;
    payload?: Record<string, unknown>;
    responseType?: TeamClusterDaemonResponseType;
};

interface BasePendingEntry {
    socketId: string;
    timeout: NodeJS.Timeout | null;
};

interface PendingResponseEntry extends BasePendingEntry {
    type: 'response';
    resolve: (payload: TeamClusterDaemonSocketResponsePayload) => void;
    reject: (error: Error) => void;
};

interface PendingStreamEntry extends BasePendingEntry {
    type: 'stream';
    stream: PassThrough;
    resolve: (attachment: TeamClusterReverseChannelStreamAttachment) => void;
    reject: (error: Error) => void;
    streamId?: string;
};

interface PendingTerminalEntry extends BasePendingEntry {
    type: 'terminal';
    stream: PassThrough;
    resolve: (attachment: ContainerTerminalAttachment) => void;
    reject: (error: Error) => void;
};

interface PendingWebSocketEntry extends BasePendingEntry {
    type: 'websocket';
    stream: TeamClusterReverseWebSocketStream;
    resolve: (stream: TeamClusterReverseWebSocketStream) => void;
    reject: (error: Error) => void;
};

export interface TeamClusterReverseChannelStreamAttachment {
    status: number;
    headers: TeamClusterDaemonSocketHeaders;
    stream: PassThrough;
};

type PendingEntry = PendingResponseEntry | PendingStreamEntry | PendingTerminalEntry | PendingWebSocketEntry;

class ReverseChannelTerminalExec implements ContainerTerminalExec {
    constructor(private readonly onResize: (size: ContainerTerminalSize) => void) {}

    async resize(size: ContainerTerminalSize): Promise<void> {
        this.onResize(size);
    }
};

class ReverseChannelTerminalStream implements ContainerTerminalStream {
    public destroyed = false;

    constructor(
        private readonly stream: PassThrough,
        private readonly onWrite: (input: string) => void,
        private readonly onDestroy: () => void
    ) {}

    write(input: string): void {
        this.onWrite(input);
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.stream.destroy();
        this.onDestroy();
    }

    removeAllListeners(event?: string): void {
        if (event) {
            this.stream.removeAllListeners(event);
            return;
        }

        this.stream.removeAllListeners();
    }

    on(...args: ['data', (chunk: Buffer) => void] | ['end', () => void] | ['error', (error: Error) => void]): void {
        if (args[0] === 'data') {
            this.stream.on('data', args[1]);
            return;
        }

        if (args[0] === 'end') {
            this.stream.on('end', args[1]);
            return;
        }

        this.stream.on('error', args[1]);
    }
};

@injectable()
export default class TeamClusterReverseChannelService {
    private readonly daemonSocketIdsByTeamClusterId = new Map<string, string>();
    private readonly teamClusterIdsBySocketId = new Map<string, string>();
    private readonly pendingEntries = new Map<string, PendingEntry>();
    private readonly connectionWaiters = new Map<string, Array<(socketId: string) => void>>();
    private readonly requestTimeoutMs = 30_000;
    private readonly terminalTimeoutMs = 15_000;
    private readonly daemonConnectionWaitTimeoutMs = 30_000;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly socketEmitter: ISocketEmitter
    ) {}

    registerDaemonConnection(socketId: string, teamClusterId: string): void {
        const previousSocketId = this.daemonSocketIdsByTeamClusterId.get(teamClusterId);
        if (previousSocketId && previousSocketId !== socketId) {
            this.unregisterDaemonConnection(previousSocketId);
        }

        this.daemonSocketIdsByTeamClusterId.set(teamClusterId, socketId);
        this.teamClusterIdsBySocketId.set(socketId, teamClusterId);

        const waiters = this.connectionWaiters.get(teamClusterId);
        if (waiters) {
            for (const resolve of waiters) {
                resolve(socketId);
            }
            this.connectionWaiters.delete(teamClusterId);
        }
    }

    unregisterDaemonConnection(socketId: string): void {
        const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
        if (teamClusterId && this.daemonSocketIdsByTeamClusterId.get(teamClusterId) === socketId) {
            this.daemonSocketIdsByTeamClusterId.delete(teamClusterId);
        }

        this.teamClusterIdsBySocketId.delete(socketId);

        for (const [correlationId, entry] of this.pendingEntries.entries()) {
            if (entry.socketId !== socketId) {
                continue;
            }

            this.rejectPendingEntry(correlationId, entry, new Error('Team cluster daemon connection was lost'));
        }
    }

    isRegisteredDaemonSocket(socketId: string): boolean {
        return this.teamClusterIdsBySocketId.has(socketId);
    }

    async command(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload
    ): Promise<TeamClusterDaemonSocketResponsePayload> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(requestId);
                if (!entry || entry.type !== 'response') {
                    return;
                }

                this.rejectPendingEntry(requestId, entry, new Error('Timed out waiting for daemon response'));
            }, this.requestTimeoutMs);

            this.pendingEntries.set(requestId, {
                type: 'response',
                socketId,
                timeout,
                resolve,
                reject
            });

            const message: TeamClusterDaemonCommandMessage = {
                type: 'command',
                requestId,
                command: payload.command,
                responseType: payload.responseType || TeamClusterDaemonResponseType.Json,
                payload: payload.payload
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    async openStream(teamClusterId: string, payload: TeamClusterDaemonCommandPayload): Promise<PassThrough> {
        const attachment = await this.openCommandStream(teamClusterId, payload);
        return attachment.stream;
    }

    async openCommandStream(teamClusterId: string, payload: TeamClusterDaemonCommandPayload): Promise<TeamClusterReverseChannelStreamAttachment> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();
        const stream = new PassThrough();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(requestId);
                if (!entry || entry.type !== 'stream') {
                    return;
                }

                this.rejectPendingEntry(requestId, entry, new Error('Timed out waiting for daemon stream response'));
            }, this.requestTimeoutMs);

            this.pendingEntries.set(requestId, {
                type: 'stream',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            });

            const message: TeamClusterDaemonCommandMessage = {
                type: 'command',
                requestId,
                command: payload.command,
                responseType: TeamClusterDaemonResponseType.Stream,
                payload: payload.payload
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new TeamClusterReverseWebSocketStream((message) => {
            const inputPayload: TeamClusterDaemonSessionInputPayload = {
                type: 'session-input',
                sessionId,
                chunkBase64: message.data.toString('base64'),
                isBinary: message.isBinary
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, inputPayload);
        }, () => {
            this.detachSession(sessionId);
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(sessionId);
                if (!entry || entry.type !== 'websocket') {
                    return;
                }

                this.rejectPendingEntry(sessionId, entry, new Error('Timed out waiting for daemon websocket attachment'));
            }, this.terminalTimeoutMs);

            this.pendingEntries.set(sessionId, {
                type: 'websocket',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            });

            const message: TeamClusterDaemonCommandMessage = {
                type: 'command',
                requestId: sessionId,
                command: 'session.attach',
                responseType: TeamClusterDaemonResponseType.Json,
                payload: {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.WebSocket,
                    targetUrl
                }
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new PassThrough();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(sessionId);
                if (!entry || entry.type !== 'terminal') {
                    return;
                }

                this.rejectPendingEntry(sessionId, entry, new Error('Timed out waiting for daemon terminal attachment'));
            }, this.terminalTimeoutMs);

            this.pendingEntries.set(sessionId, {
                type: 'terminal',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            });

            const message: TeamClusterDaemonCommandMessage = {
                type: 'command',
                requestId: sessionId,
                command: 'session.attach',
                responseType: TeamClusterDaemonResponseType.Json,
                payload: {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.Terminal,
                    containerId
                }
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    handleMessage(socketId: string, payload: TeamClusterDaemonMessage): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        if (payload.type === 'response') {
            this.handleResponsePayload(payload);
            return;
        }

        if (payload.type === 'stream') {
            this.handleStreamChunkPayload(payload);
            return;
        }

        if (payload.type === 'stream-end') {
            this.handleStreamStatePayload(payload);
            return;
        }

        if (payload.type === 'session-data') {
            this.handleSessionDataPayload(payload);
            return;
        }

        if (payload.type === 'session-end') {
            this.handleSessionEndPayload(payload);
        }
    }

    detachSession(sessionId: string): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || (entry.type !== 'terminal' && entry.type !== 'websocket')) {
            return;
        }

        const detachPayload: TeamClusterDaemonSessionDetachPayload = {
            type: 'session-detach',
            sessionId
        };
        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, detachPayload);

        if (entry.type === 'terminal') {
            entry.stream.destroy();
        }
        this.pendingEntries.delete(sessionId);
    }

    private handleResponsePayload(payload: TeamClusterDaemonSocketResponsePayload): void {
        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry) {
            return;
        }

        if (entry.type === 'response') {
            this.pendingEntries.delete(payload.requestId);
            this.clearTimeout(entry.timeout);
            entry.resolve(payload);
            return;
        }

        if (entry.type !== 'stream') {
            return;
        }

        this.clearTimeout(entry.timeout);
        entry.timeout = null;

        if (!payload.ok) {
            this.pendingEntries.delete(payload.requestId);
            entry.reject(new Error(payload.message || 'Daemon stream request failed'));
            return;
        }

        entry.streamId = payload.streamId || payload.requestId;
        entry.resolve({
            status: payload.status,
            headers: payload.headers || {},
            stream: entry.stream
        });
    }

    private handleStreamChunkPayload(payload: TeamClusterDaemonSocketStreamPayload): void {
        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry || entry.type !== 'stream') {
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        entry.stream.write(Buffer.from(payload.chunkBase64, 'base64'));
    }

    private handleStreamStatePayload(payload: TeamClusterDaemonSocketStreamStatePayload): void {
        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry || entry.type !== 'stream') {
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        entry.stream.end();
        this.pendingEntries.delete(payload.requestId);
    }

    private handleSessionDataPayload(payload: TeamClusterDaemonSessionDataPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry) {
            return;
        }

        if (entry.type === 'terminal') {
            entry.stream.write(Buffer.from(payload.chunkBase64, 'base64'));
            return;
        }

        if (entry.type === 'websocket') {
            entry.stream.emitData({
                data: Buffer.from(payload.chunkBase64, 'base64'),
                isBinary: payload.isBinary
            });
        }
    }

    private handleSessionEndPayload(payload: TeamClusterDaemonSessionEndPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry) {
            return;
        }

        const error = payload.error ? new Error(payload.error) : undefined;

        if (entry.type === 'terminal') {
            if (entry.timeout) {
                this.clearTimeout(entry.timeout);
                entry.timeout = null;
                if (error) {
                    this.pendingEntries.delete(payload.sessionId);
                    entry.reject(error);
                    return;
                }

                entry.resolve({
                    exec: new ReverseChannelTerminalExec((size) => {
                        const resizePayload: TeamClusterDaemonSessionResizePayload = {
                            type: 'session-resize',
                            sessionId: payload.sessionId,
                            rows: size.rows,
                            cols: size.cols
                        };
                        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, resizePayload);
                    }),
                    stream: new ReverseChannelTerminalStream(entry.stream, (input) => {
                        const inputPayload: TeamClusterDaemonSessionInputPayload = {
                            type: 'session-input',
                            sessionId: payload.sessionId,
                            chunkBase64: Buffer.from(input, 'utf8').toString('base64'),
                            isBinary: false
                        };
                        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, inputPayload);
                    }, () => {
                        this.detachSession(payload.sessionId);
                    })
                });
                return;
            }

            if (error) {
                entry.stream.emit('error', error);
            }
            entry.stream.end();
            this.pendingEntries.delete(payload.sessionId);
            return;
        }

        if (entry.type === 'websocket') {
            if (entry.timeout) {
                this.clearTimeout(entry.timeout);
                entry.timeout = null;
                if (error) {
                    this.pendingEntries.delete(payload.sessionId);
                    entry.reject(error);
                    return;
                }

                entry.resolve(entry.stream);
                return;
            }

            if (error) {
                entry.stream.emitError(error);
            } else {
                entry.stream.emitEnd({
                    code: payload.code,
                    message: payload.message
                });
            }
            this.pendingEntries.delete(payload.sessionId);
        }
    }

    private clearTimeout(timeout: NodeJS.Timeout | null): void {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    private async requireDaemonSocketId(teamClusterId: string): Promise<string> {
        const socketId = this.daemonSocketIdsByTeamClusterId.get(teamClusterId);
        if (socketId) {
            return socketId;
        }

        logger.info(`[ReverseChannel] Waiting for daemon reconnection: cluster=${teamClusterId}`);

        return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                const waiters = this.connectionWaiters.get(teamClusterId);
                if (waiters) {
                    const idx = waiters.indexOf(onConnected);
                    if (idx >= 0) {
                        waiters.splice(idx, 1);
                    }
                    if (waiters.length === 0) {
                        this.connectionWaiters.delete(teamClusterId);
                    }
                }

                reject(ApplicationError.conflict(
                    'TeamCluster::DaemonUnavailable',
                    'Team cluster daemon reverse channel is not connected'
                ));
            }, this.daemonConnectionWaitTimeoutMs);

            const onConnected = (nextSocketId: string) => {
                clearTimeout(timeout);
                resolve(nextSocketId);
            };

            if (!this.connectionWaiters.has(teamClusterId)) {
                this.connectionWaiters.set(teamClusterId, []);
            }
            this.connectionWaiters.get(teamClusterId)?.push(onConnected);
        });
    }

    private rejectPendingEntry(correlationId: string, entry: PendingEntry, error: Error): void {
        this.pendingEntries.delete(correlationId);
        this.clearTimeout(entry.timeout);

        if (entry.type === 'response') {
            entry.reject(error);
            return;
        }

        if (entry.type === 'terminal') {
            if (entry.timeout) {
                entry.reject(error);
                return;
            }

            entry.stream.emit('error', error);
            entry.stream.destroy();
            return;
        }

        if (entry.type === 'websocket') {
            if (entry.timeout) {
                entry.reject(error);
                return;
            }

            entry.stream.emitError(error);
            entry.stream.destroy();
            return;
        }

        entry.stream.emit('error', error);
        entry.stream.destroy();
        entry.reject(error);
    }
};
