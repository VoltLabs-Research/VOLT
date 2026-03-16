import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ContainerDeploymentProgressService } from '@modules/container/infrastructure/services/ContainerDeploymentProgressService';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TeamClusterDaemonResponseType,
    TeamClusterServiceExposureAccessMode,
    TeamClusterDaemonSessionKind,
    TeamClusterTunnelSessionStatus,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonExposureSnapshotPayload,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionDetachPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSessionInputPayload,
    type TeamClusterDaemonSessionResizePayload,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonRuntimeProgressPayload,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonTunnelClosePayload,
    type TeamClusterDaemonTunnelDataPayload,
    type TeamClusterDaemonTunnelStatePayload
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseTunnelStream } from '@modules/team-cluster/utilities/TeamClusterReverseTunnelStream';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import { inject, injectable } from 'tsyringe';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type {
    ContainerTerminalAttachment,
    ContainerTerminalExec,
    ContainerTerminalSize,
    ContainerTerminalStream
} from '@modules/container/domain/port/IContainerService';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type TeamClusterExposureRegistryService from './TeamClusterExposureRegistryService';

interface TeamClusterDaemonCommandPayload {
    command: string;
    payload?: Record<string, unknown>;
    responseType: TeamClusterDaemonResponseType;
};

export interface TeamClusterExposureTunnelOpenRequest {
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
};

export interface TeamClusterDirectTunnelOpenRequest {
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
};

export type TeamClusterTunnelOpenRequest = TeamClusterExposureTunnelOpenRequest | TeamClusterDirectTunnelOpenRequest;

interface TeamClusterDaemonExposureTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
};

interface TeamClusterDaemonDirectTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
};

type TeamClusterDaemonTunnelOpenMessage = TeamClusterDaemonExposureTunnelOpenMessage | TeamClusterDaemonDirectTunnelOpenMessage;

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

interface PendingTunnelEntry extends BasePendingEntry {
    type: 'tunnel';
    stream: TeamClusterReverseTunnelStream;
    resolve: (stream: TeamClusterReverseTunnelStream) => void;
    reject: (error: Error) => void;
};

export class TeamClusterDaemonStreamError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly headers: TeamClusterDaemonSocketHeaders = {}
    ) {
        super(message);
        Object.setPrototypeOf(this, TeamClusterDaemonStreamError.prototype);
    }
}

export interface TeamClusterReverseChannelStreamAttachment {
    status: number;
    headers: TeamClusterDaemonSocketHeaders;
    stream: PassThrough;
};

type PendingEntry = PendingResponseEntry | PendingStreamEntry | PendingTerminalEntry | PendingWebSocketEntry | PendingTunnelEntry;

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
        private readonly socketEmitter: ISocketEmitter,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService,

        @inject(ContainerDeploymentProgressService)
        private readonly containerDeploymentProgressService: ContainerDeploymentProgressService
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
            this.exposureRegistryService.clearTeamCluster(teamClusterId);
            logger.warn({ socketId, teamClusterId }, '[ReverseChannel] Daemon connection unregistered');
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
        payload: TeamClusterDaemonCommandPayload,
        options?: { timeoutMs?: number }
    ): Promise<TeamClusterDaemonSocketResponsePayload> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();
        const effectiveTimeoutMs = options?.timeoutMs ?? this.requestTimeoutMs;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(requestId);
                if (!entry || entry.type !== 'response') {
                    return;
                }

                this.rejectPendingEntry(requestId, entry, new Error('Timed out waiting for daemon response'));
            }, effectiveTimeoutMs);

            this.pendingEntries.set(requestId, {
                type: 'response',
                socketId,
                timeout,
                resolve,
                reject
            });

            const message = this.createCommandMessage(requestId, payload);
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

            const message = this.createCommandMessage(requestId, {
                command: payload.command,
                payload: payload.payload,
                responseType: TeamClusterDaemonResponseType.Stream
            });
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

            const message = this.createCommandMessage(sessionId, {
                command: 'session.attach',
                responseType: TeamClusterDaemonResponseType.Json,
                payload: {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.WebSocket,
                    targetUrl
                }
            });
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

            const message = this.createCommandMessage(sessionId, {
                command: 'session.attach',
                responseType: TeamClusterDaemonResponseType.Json,
                payload: {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.Terminal,
                    containerId
                }
            });
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    async openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessMode?: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterReverseTunnelStream> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const openPayload = this.createTunnelOpenPayload(sessionId, target, accessMode);
        const stream = new TeamClusterReverseTunnelStream({
            onWrite: (chunk) => {
                const inputPayload: TeamClusterDaemonTunnelDataPayload = {
                    type: 'tunnel-data',
                    sessionId,
                    chunkBase64: chunk.data.toString('base64'),
                    isBinary: chunk.isBinary
                };
                this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, inputPayload);
            },
            onClose: () => {
                this.closeTunnel(sessionId);
            }
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(sessionId);
                if (!entry || entry.type !== 'tunnel') {
                    return;
                }

                this.rejectPendingEntry(sessionId, entry, new Error('Timed out waiting for daemon tunnel attachment'));
            }, this.terminalTimeoutMs);

            this.pendingEntries.set(sessionId, {
                type: 'tunnel',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            });

            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, openPayload);
        });
    }

    async attachHostTerminal(teamClusterId: string): Promise<ContainerTerminalAttachment> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new PassThrough();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const entry = this.pendingEntries.get(sessionId);
                if (!entry || entry.type !== 'terminal') {
                    return;
                }

                this.rejectPendingEntry(sessionId, entry, new Error('Timed out waiting for daemon host terminal attachment'));
            }, this.terminalTimeoutMs);

            this.pendingEntries.set(sessionId, {
                type: 'terminal',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            });

            const message = this.createCommandMessage(sessionId, {
                command: 'session.attach',
                responseType: TeamClusterDaemonResponseType.Json,
                payload: {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.Terminal,
                    terminalTarget: 'host'
                }
            });
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
        });
    }

    handleMessage(socketId: string, payload: TeamClusterDaemonMessage): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        if (payload.type === 'exposure-snapshot') {
            const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
            if (!teamClusterId) {
                return;
            }

            this.handleExposureSnapshotPayload(teamClusterId, payload);
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
            return;
        }

        if (payload.type === 'tunnel-state') {
            this.handleTunnelStatePayload(payload);
            return;
        }

        if (payload.type === 'tunnel-data') {
            this.handleTunnelDataPayload(payload);
            return;
        }

        if (payload.type === 'tunnel-close') {
            this.handleTunnelClosePayload(payload);
            return;
        }

        if (payload.type === 'runtime-progress') {
            void this.handleRuntimeProgressPayload(socketId, payload);
        }
    }

    private async handleRuntimeProgressPayload(
        socketId: string,
        payload: TeamClusterDaemonRuntimeProgressPayload
    ): Promise<void> {
        const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
        if (!teamClusterId) {
            return;
        }

        if (payload.action !== 'container-create') {
            return;
        }

        const operationId = typeof payload.payload?.operationId === 'string'
            ? payload.payload.operationId
            : null;

        if (!operationId) {
            return;
        }

        await this.containerDeploymentProgressService.emitToTeam({
            operationId,
            teamClusterId,
            stage: payload.stage,
            step: typeof payload.payload?.step === 'string' ? payload.payload.step : undefined,
            image: typeof payload.payload?.image === 'string' ? payload.payload.image : undefined,
            containerName: typeof payload.payload?.containerName === 'string' ? payload.payload.containerName : undefined,
            containerId: typeof payload.payload?.containerId === 'string' ? payload.payload.containerId : undefined,
            timestamp: payload.timestamp
        });
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

    private closeTunnel(sessionId: string): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        const closePayload: TeamClusterDaemonTunnelClosePayload = {
            type: 'tunnel-close',
            sessionId
        };
        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, closePayload);
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
            if (entry.type === 'terminal' || entry.type === 'websocket') {
                this.handleSessionAttachResponse(payload, entry);
            }

            return;
        }

        this.clearTimeout(entry.timeout);
        entry.timeout = null;

        if (!payload.ok) {
            this.pendingEntries.delete(payload.requestId);
            entry.reject(new TeamClusterDaemonStreamError(
                payload.message || 'Daemon stream request failed',
                payload.status,
                payload.headers || {}
            ));
            return;
        }

        entry.streamId = payload.streamId || payload.requestId;
        entry.resolve({
            status: payload.status,
            headers: payload.headers || {},
            stream: entry.stream
        });
    }

    private handleSessionAttachResponse(
        payload: TeamClusterDaemonSocketResponsePayload,
        entry: PendingTerminalEntry | PendingWebSocketEntry
    ): void {
        if (!entry.timeout) {
            return;
        }

        if (!payload.ok) {
            this.rejectPendingEntry(
                payload.requestId,
                entry,
                new Error(payload.message || 'Daemon session attach failed')
            );

            return;
        }

        this.clearTimeout(entry.timeout);
        entry.timeout = null;

        if (entry.type === 'terminal') {
            entry.resolve(this.createTerminalAttachment(entry, payload.requestId));
            return;
        }

        entry.resolve(entry.stream);
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

    private handleExposureSnapshotPayload(teamClusterId: string, payload: TeamClusterDaemonExposureSnapshotPayload): void {
        this.exposureRegistryService.replaceTeamClusterExposures(teamClusterId, payload.exposures);
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
            return;
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
                this.rejectPendingEntry(
                    payload.sessionId,
                    entry,
                    error || new Error(payload.message || 'Daemon terminal session ended before attachment completed')
                );

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
                this.rejectPendingEntry(
                    payload.sessionId,
                    entry,
                    error || new Error(payload.message || 'Daemon websocket session ended before attachment completed')
                );

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

    private createTerminalAttachment(entry: PendingTerminalEntry, sessionId: string): ContainerTerminalAttachment {
        return {
            exec: new ReverseChannelTerminalExec((size) => {
                const resizePayload: TeamClusterDaemonSessionResizePayload = {
                    type: 'session-resize',
                    sessionId,
                    rows: size.rows,
                    cols: size.cols
                };

                this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, resizePayload);
            }),
            stream: new ReverseChannelTerminalStream(entry.stream, (input) => {
                const inputPayload: TeamClusterDaemonSessionInputPayload = {
                    type: 'session-input',
                    sessionId,
                    chunkBase64: Buffer.from(input, 'utf8').toString('base64'),
                    isBinary: false
                };

                this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, inputPayload);
            }, () => {
                this.detachSession(sessionId);
            })
        };
    }

    private handleTunnelStatePayload(payload: TeamClusterDaemonTunnelStatePayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        if (payload.status === TeamClusterTunnelSessionStatus.Opening) {
            return;
        }

        const error = payload.error ? new Error(payload.error) : undefined;
        if (entry.timeout) {
            this.clearTimeout(entry.timeout);
            entry.timeout = null;

            if (payload.status !== TeamClusterTunnelSessionStatus.Open || error) {
                this.pendingEntries.delete(payload.sessionId);
                entry.reject(error || new Error(payload.message || 'Failed to open daemon tunnel'));
                return;
            }

            entry.resolve(entry.stream);
            return;
        }

        if (error) {
            entry.stream.fail(error);
        } else if (payload.status === TeamClusterTunnelSessionStatus.Closed) {
            entry.stream.closeRemote();
        }

        this.pendingEntries.delete(payload.sessionId);
    }

    private handleTunnelDataPayload(payload: TeamClusterDaemonTunnelDataPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        entry.stream.pushChunk(Buffer.from(payload.chunkBase64, 'base64'));
    }

    private handleTunnelClosePayload(payload: TeamClusterDaemonTunnelClosePayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        entry.stream.closeRemote();
        this.pendingEntries.delete(payload.sessionId);
    }

    private clearTimeout(timeout: NodeJS.Timeout | null): void {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    private createCommandMessage(
        requestId: string,
        payload: TeamClusterDaemonCommandPayload
    ): TeamClusterDaemonCommandMessage {
        return {
            type: 'command',
            requestId,
            command: payload.command,
            responseType: this.requireCommandResponseType(payload.responseType),
            payload: payload.payload
        };
    }

    private requireCommandResponseType(
        responseType: TeamClusterDaemonResponseType | undefined
    ): TeamClusterDaemonResponseType {
        if (!responseType) {
            throw ApplicationError.internalServerError('Daemon command response type is required');
        }

        return responseType;
    }

    private createTunnelOpenPayload(
        sessionId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessMode?: TeamClusterServiceExposureAccessMode
    ): TeamClusterDaemonTunnelOpenMessage {
        if (typeof target === 'string') {
            if (!accessMode) {
                throw ApplicationError.badRequest(
                    'TeamCluster::TunnelAccessModeRequired',
                    'Tunnel access mode is required when opening a tunnel by exposure id'
                );
            }

            return {
                type: 'tunnel-open',
                sessionId,
                exposureId: target,
                accessMode
            };
        }

        if ('exposureId' in target) {
            return {
                type: 'tunnel-open',
                sessionId,
                exposureId: target.exposureId,
                accessMode: target.accessMode
            };
        }

        return {
            type: 'tunnel-open',
            sessionId,
            targetHost: target.targetHost,
            targetPort: target.targetPort,
            accessMode: target.accessMode
        };
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

        if (entry.type === 'tunnel') {
            if (entry.timeout) {
                entry.reject(error);
                return;
            }

            entry.stream.fail(error);
            return;
        }

        entry.stream.emit('error', error);
        entry.stream.destroy();
        entry.reject(error);
    }
};
