import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import {
    TEAM_CLUSTER_DAEMON_REQUEST_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_END_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT,
    type TeamClusterDaemonSocketRequestPayload,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonTerminalAttachPayload,
    type TeamClusterDaemonTerminalDataPayload,
    type TeamClusterDaemonTerminalDetachPayload,
    type TeamClusterDaemonTerminalInputPayload,
    type TeamClusterDaemonTerminalResizePayload,
    type TeamClusterDaemonTerminalStatePayload,
    type TeamClusterDaemonWebSocketAttachPayload,
    type TeamClusterDaemonWebSocketDataPayload,
    type TeamClusterDaemonWebSocketDetachPayload,
    type TeamClusterDaemonWebSocketStatePayload
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
    private readonly requestTimeoutMs = 30_000;
    private readonly terminalTimeoutMs = 15_000;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly socketEmitter: ISocketEmitter
    ) {}

    registerDaemonConnection(socketId: string, teamClusterId: string): void {
        const previousSocketId = this.daemonSocketIdsByTeamClusterId.get(teamClusterId);
        if (previousSocketId && previousSocketId !== socketId) {
            logger.info(`[ReverseChannel] Evicting previous daemon socket ${previousSocketId} for cluster ${teamClusterId}`);
            this.unregisterDaemonConnection(previousSocketId);
        }

        this.daemonSocketIdsByTeamClusterId.set(teamClusterId, socketId);
        this.teamClusterIdsBySocketId.set(socketId, teamClusterId);
        logger.info(`[ReverseChannel] Daemon registered: cluster=${teamClusterId} socket=${socketId} (total=${this.daemonSocketIdsByTeamClusterId.size})`);
    }

    unregisterDaemonConnection(socketId: string): void {
        const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
        if (teamClusterId && this.daemonSocketIdsByTeamClusterId.get(teamClusterId) === socketId) {
            this.daemonSocketIdsByTeamClusterId.delete(teamClusterId);
        }

        this.teamClusterIdsBySocketId.delete(socketId);
        logger.info(`[ReverseChannel] Daemon unregistered: socket=${socketId} cluster=${teamClusterId || 'unknown'} (total=${this.daemonSocketIdsByTeamClusterId.size})`);

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

    async request(
        teamClusterId: string,
        payload: Omit<TeamClusterDaemonSocketRequestPayload, 'requestId'>
    ): Promise<TeamClusterDaemonSocketResponsePayload> {
        const socketId = this.requireDaemonSocketId(teamClusterId);
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

            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_REQUEST_EVENT, {
                ...payload,
                requestId
            });
        });
    }

    async openStream(
        teamClusterId: string,
        payload: Omit<TeamClusterDaemonSocketRequestPayload, 'requestId'>
    ): Promise<PassThrough> {
        const attachment = await this.openHttpStream(teamClusterId, payload);
        return attachment.stream;
    }

    async openHttpStream(
        teamClusterId: string,
        payload: Omit<TeamClusterDaemonSocketRequestPayload, 'requestId'>
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        const socketId = this.requireDaemonSocketId(teamClusterId);
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

            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_REQUEST_EVENT, {
                ...payload,
                requestId
            });
        });
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        const socketId = this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new TeamClusterReverseWebSocketStream((message) => {
            const inputPayload: TeamClusterDaemonWebSocketDataPayload = {
                sessionId,
                chunkBase64: message.data.toString('base64'),
                isBinary: message.isBinary
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT, inputPayload);
        }, () => {
            this.detachWebSocket(sessionId);
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

            const attachPayload: TeamClusterDaemonWebSocketAttachPayload = {
                sessionId,
                targetUrl
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT, attachPayload);
        });
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        const socketId = this.requireDaemonSocketId(teamClusterId);
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

            const attachPayload: TeamClusterDaemonTerminalAttachPayload = {
                sessionId,
                containerId
            };
            this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT, attachPayload);
        });
    }

    handleResponse(socketId: string, payload: TeamClusterDaemonSocketResponsePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

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
            // The stream has not been resolved yet, so only reject the promise
            // (do not emit on the stream — it has no listeners at this point).
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

    handleStreamChunk(socketId: string, payload: TeamClusterDaemonSocketStreamPayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry || entry.type !== 'stream') {
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        entry.stream.write(Buffer.from(payload.chunkBase64, 'base64'));
    }

    handleStreamEnd(socketId: string, payload: TeamClusterDaemonSocketStreamStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

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

    handleStreamError(socketId: string, payload: TeamClusterDaemonSocketStreamStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry || entry.type !== 'stream') {
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        entry.stream.emit('error', new Error(payload.message || 'Daemon stream failed'));
        entry.stream.destroy();
        this.pendingEntries.delete(payload.requestId);
    }

    handleTerminalAttached(socketId: string, payload: TeamClusterDaemonTerminalDetachPayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'terminal') {
            return;
        }

        this.clearTimeout(entry.timeout);
        entry.timeout = null;

        entry.resolve({
            exec: new ReverseChannelTerminalExec((size) => {
                const resizePayload: TeamClusterDaemonTerminalResizePayload = {
                    sessionId: payload.sessionId,
                    rows: size.rows,
                    cols: size.cols
                };
                this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT, resizePayload);
            }),
            stream: new ReverseChannelTerminalStream(entry.stream, (input) => {
                const inputPayload: TeamClusterDaemonTerminalInputPayload = {
                    sessionId: payload.sessionId,
                    input
                };
                this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT, inputPayload);
            }, () => {
                this.detachTerminal(payload.sessionId);
            })
        });
    }

    handleTerminalData(socketId: string, payload: TeamClusterDaemonTerminalDataPayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'terminal') {
            return;
        }

        entry.stream.write(Buffer.from(payload.chunkBase64, 'base64'));
    }

    handleTerminalEnd(socketId: string, payload: TeamClusterDaemonTerminalStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'terminal') {
            return;
        }

        entry.stream.end();
        this.pendingEntries.delete(payload.sessionId);
    }

    handleTerminalError(socketId: string, payload: TeamClusterDaemonTerminalStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'terminal') {
            return;
        }

        const error = new Error(payload.message || 'Daemon terminal failed');
        if (entry.timeout) {
            this.rejectPendingEntry(payload.sessionId, entry, error);
            return;
        }

        entry.stream.emit('error', error);
        entry.stream.destroy();
        this.pendingEntries.delete(payload.sessionId);
    }

    handleWebSocketAttached(socketId: string, payload: TeamClusterDaemonWebSocketDetachPayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'websocket') {
            return;
        }

        this.clearTimeout(entry.timeout);
        entry.timeout = null;
        entry.resolve(entry.stream);
    }

    handleWebSocketData(socketId: string, payload: TeamClusterDaemonWebSocketDataPayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'websocket') {
            return;
        }

        entry.stream.emitData({
            data: Buffer.from(payload.chunkBase64, 'base64'),
            isBinary: payload.isBinary
        });
    }

    handleWebSocketEnd(socketId: string, payload: TeamClusterDaemonWebSocketStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'websocket') {
            return;
        }

        entry.stream.emitEnd({
            code: payload.code,
            message: payload.message
        });
        this.pendingEntries.delete(payload.sessionId);
    }

    handleWebSocketError(socketId: string, payload: TeamClusterDaemonWebSocketStatePayload): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'websocket') {
            return;
        }

        const error = new Error(payload.message || 'Daemon websocket failed');
        if (entry.timeout) {
            this.rejectPendingEntry(payload.sessionId, entry, error);
            return;
        }

        entry.stream.emitError(error);
        entry.stream.destroy();
        this.pendingEntries.delete(payload.sessionId);
    }

    detachTerminal(sessionId: string): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || entry.type !== 'terminal') {
            return;
        }

        const detachPayload: TeamClusterDaemonTerminalDetachPayload = { sessionId };
        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT, detachPayload);
        entry.stream.destroy();
        this.pendingEntries.delete(sessionId);
    }

    detachWebSocket(sessionId: string): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || entry.type !== 'websocket') {
            return;
        }

        const detachPayload: TeamClusterDaemonWebSocketDetachPayload = { sessionId };
        this.socketEmitter.emitToSocket(entry.socketId, TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT, detachPayload);
        this.pendingEntries.delete(sessionId);
    }

    private clearTimeout(timeout: NodeJS.Timeout | null): void {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    private requireDaemonSocketId(teamClusterId: string): string {
        const socketId = this.daemonSocketIdsByTeamClusterId.get(teamClusterId);
        if (!socketId) {
            const registeredIds = Array.from(this.daemonSocketIdsByTeamClusterId.keys());
            logger.error(`[ReverseChannel] Daemon not connected for cluster=${teamClusterId}, registered clusters=[${registeredIds.join(', ')}]`);
            throw ApplicationError.conflict(
                'TeamCluster::DaemonUnavailable',
                'Team cluster daemon reverse channel is not connected'
            );
        }

        return socketId;
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
