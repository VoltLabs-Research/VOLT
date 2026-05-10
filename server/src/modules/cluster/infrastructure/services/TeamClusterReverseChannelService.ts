import { ErrorCodes } from '@core/constants/error-codes';
import type {
    ContainerTerminalAttachment,
    ContainerTerminalSize
} from '@modules/container/domain/port/IContainerService';
import { ContainerDeploymentProgressService } from '@modules/container/infrastructure/services/ContainerDeploymentProgressService';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import { TeamClusterReverseTerminalExec, TeamClusterReverseTerminalStream } from '@modules/cluster/utilities/TeamClusterReverseTerminal';
import {
    TeamClusterReverseTunnelStream,
    type TeamClusterTunnelStream
} from '@modules/cluster/utilities/TeamClusterReverseTunnelStream';
import { TeamClusterReverseWebSocketStream } from '@modules/cluster/utilities/teamClusterReverseWebSocket';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionKind,
    TeamClusterServiceExposureAccessMode,
    TeamClusterTunnelSessionStatus,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonExposureSnapshotPayload,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRuntimeProgressPayload,
    type TeamClusterDaemonSessionAttachPayload,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionDetachPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSessionInputPayload,
    type TeamClusterDaemonSessionResizePayload,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonTunnelClosePayload,
    type TeamClusterDaemonTunnelDataPayload,
    type TeamClusterDaemonTunnelDrainPayload,
    type TeamClusterDaemonTunnelStatePayload
} from '@modules/cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import {
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope,
    toUint8Array
} from '@shared/infrastructure/types/reverseChannelBinary';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import TeamClusterExposureRegistryService from './TeamClusterExposureRegistryService';

type TeamClusterDaemonCommandData = Record<string, unknown> | TeamClusterDaemonSessionAttachPayload;

interface TeamClusterDaemonCommandPayload {
    command: string;
    payload?: TeamClusterDaemonCommandData;
    responseType: TeamClusterDaemonResponseType;
}

interface TeamClusterExposureTunnelOpenRequest {
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

interface TeamClusterCommandOptions {
    timeoutMs?: number;
}

interface TeamClusterDirectTunnelOpenRequest {
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export type TeamClusterTunnelOpenRequest = TeamClusterExposureTunnelOpenRequest | TeamClusterDirectTunnelOpenRequest;

export interface TeamClusterTunnelOpenOptions {
    timeoutMs?: number;
    timeoutMessage?: string;
}

interface TeamClusterDaemonExposureTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

interface TeamClusterDaemonDirectTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

type TeamClusterDaemonTunnelOpenMessage = TeamClusterDaemonExposureTunnelOpenMessage | TeamClusterDaemonDirectTunnelOpenMessage;

interface BasePendingEntry {
    socketId: string;
    timeout: NodeJS.Timeout | null;
}

interface PendingResponseEntry extends BasePendingEntry {
    type: 'response';
    resolve: (payload: TeamClusterDaemonSocketResponsePayload) => void;
    reject: (error: Error) => void;
}

interface PendingStreamEntry extends BasePendingEntry {
    type: 'stream';
    stream: PassThrough;
    resolve: (attachment: TeamClusterReverseChannelStreamAttachment) => void;
    reject: (error: Error) => void;
    streamId?: string;
}

interface PendingTerminalEntry extends BasePendingEntry {
    type: 'terminal';
    stream: PassThrough;
    resolve: (attachment: ContainerTerminalAttachment) => void;
    reject: (error: Error) => void;
}

interface PendingWebSocketEntry extends BasePendingEntry {
    type: 'websocket';
    stream: TeamClusterReverseWebSocketStream;
    resolve: (stream: TeamClusterReverseWebSocketStream) => void;
    reject: (error: Error) => void;
}

interface WebSocketAttachSuccessPayload {
    status?: unknown;
    data?: {
        attached?: unknown;
        selectedProtocol?: unknown;
    };
}

interface PendingTunnelEntry extends BasePendingEntry {
    type: 'tunnel';
    stream: TeamClusterTunnelStream;
    resolve: (stream: TeamClusterTunnelStream) => void;
    reject: (error: Error) => void;
    nextWriteSequence: number;
    pendingWriteAcks: Map<number, PendingTunnelWriteAck>;
    pendingWriteBytes: number;
    blockedWriteCallback?: (error?: Error | null) => void;
}

interface PendingPromiseOptions<TResult, TEntry extends PendingEntry> {
    correlationId: string;
    entryType: PendingEntry['type'];
    timeoutMs: number;
    timeoutMessage: string;
    createEntry: (resolve: (value: TResult) => void, reject: (error: Error) => void, timeout: NodeJS.Timeout) => TEntry;
    emitMessage: () => void;
}

interface PendingTunnelWriteAck {
    bytes: number;
    timeout: NodeJS.Timeout;
}

export interface TeamClusterReverseChannelStreamAttachment {
    status: number;
    headers: TeamClusterDaemonSocketHeaders;
    stream: PassThrough;
}

type PendingEntry = PendingResponseEntry | PendingStreamEntry | PendingTerminalEntry | PendingWebSocketEntry | PendingTunnelEntry;

const readSelectedWebSocketProtocol = (payload: unknown): string | undefined => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return undefined;
    }

    const candidate = payload as WebSocketAttachSuccessPayload;
    if (candidate.status !== 'success') {
        return undefined;
    }

    const selectedProtocol = candidate.data?.selectedProtocol;
    return typeof selectedProtocol === 'string' && selectedProtocol.trim().length > 0
        ? selectedProtocol.trim()
        : undefined;
};

const readPositiveIntegerEnv = (name: string, fallback: number): number => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : fallback;
};

const TUNNEL_FLOW_CONTROL_WINDOW_BYTES = readPositiveIntegerEnv(
    'TEAM_CLUSTER_REVERSE_TUNNEL_WINDOW_BYTES',
    8 * 1024 * 1024
);
const TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES = Math.max(
    64 * 1024,
    Math.floor(TUNNEL_FLOW_CONTROL_WINDOW_BYTES / 2)
);
const TUNNEL_DRAIN_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_REVERSE_TUNNEL_DRAIN_TIMEOUT_MS',
    120_000
);

@Singleton()
export default class TeamClusterReverseChannelService {
    private readonly daemonSocketIdsByTeamClusterId = new Map<string, string>();
    private readonly teamClusterIdsBySocketId = new Map<string, string>();
    private readonly pendingEntries = new Map<string, PendingEntry>();
    private readonly connectionWaiters = new Map<string, Array<(socketId: string) => void>>();
    private readonly requestTimeoutMs = 30_000;
    private readonly terminalTimeoutMs = 15_000;
    private readonly daemonConnectionWaitTimeoutMs = 30_000;

    /**
     * Maximum time (ms) a resolved session (terminal, websocket, tunnel) can
     * remain idle (no data flowing) before being reaped. Prevents orphaned
     * entries from accumulating when the daemon silently drops a session.
     */
    private readonly sessionIdleTtlMs = 10 * 60 * 1000;
    private readonly sessionSweepIntervalMs = 60 * 1000;

    /** Tracks last activity timestamp for resolved sessions. */
    private readonly sessionActivity = new Map<string, number>();
    private idleSweepTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * High-water mark for PassThrough streams used in streaming responses,
     * terminal sessions, etc.  Limits how much data can be buffered in a
     * single stream before backpressure kicks in.
     */
    private readonly streamHighWaterMark = 256 * 1024; // 256 KB

    constructor(
        private readonly socketEmitter: SocketIOEmitter,
        private readonly exposureRegistryService: TeamClusterExposureRegistryService,
        private readonly containerDeploymentProgressService: ContainerDeploymentProgressService
    ) {
        this.startIdleSweep();
    }

    /**
     * Records activity for a resolved session so its idle TTL resets.
     */
    private touchSession(sessionId: string): void {
        this.sessionActivity.set(sessionId, Date.now());
    }

    /**
     * Removes activity tracking for a session.
     */
    private untouchSession(sessionId: string): void {
        this.sessionActivity.delete(sessionId);
    }

    /**
     * Periodically reaps resolved sessions that have been idle beyond
     * `sessionIdleTtlMs`.
     */
    private startIdleSweep(): void {
        if (this.idleSweepTimer) return;

        this.idleSweepTimer = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, lastActive] of this.sessionActivity) {
                if (now - lastActive > this.sessionIdleTtlMs) {
                    const entry = this.pendingEntries.get(sessionId);
                    if (!entry) {
                        this.sessionActivity.delete(sessionId);
                        continue;
                    }

                    logger.warn(`[ReverseChannel] Session idle TTL expired — cleaning up sessionId=${sessionId} type=${entry.type}`);

                    if (entry.type === 'terminal') {
                        entry.stream.destroy();
                    } else if (entry.type === 'websocket') {
                        entry.stream.destroy();
                    } else if (entry.type === 'tunnel') {
                        this.failPendingTunnelWrites(entry, new Error('Tunnel session idle TTL expired'));
                        entry.stream.closeRemote();
                    } else if (entry.type === 'stream') {
                        entry.stream.destroy();
                    }

                    this.pendingEntries.delete(sessionId);
                    this.sessionActivity.delete(sessionId);
                }
            }
        }, this.sessionSweepIntervalMs);
        this.idleSweepTimer.unref();
    }

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

    unregisterDaemonConnection(socketId: string): string | null {
        const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
        if (teamClusterId && this.daemonSocketIdsByTeamClusterId.get(teamClusterId) === socketId) {
            this.daemonSocketIdsByTeamClusterId.delete(teamClusterId);
            this.exposureRegistryService.clearTeamCluster(teamClusterId);
            logger.warn(`[ReverseChannel] Daemon connection unregistered socketId=${socketId} teamClusterId=${teamClusterId}`);
        }

        this.teamClusterIdsBySocketId.delete(socketId);

        for (const [correlationId, entry] of this.pendingEntries.entries()) {
            if (entry.socketId !== socketId) {
                continue;
            }

            this.rejectPendingEntry(correlationId, entry, new Error('Team cluster daemon connection was lost'));
        }

        return teamClusterId ?? null;
    }

    isRegisteredDaemonSocket(socketId: string): boolean {
        return this.teamClusterIdsBySocketId.has(socketId);
    }

    getRegisteredTeamClusterId(socketId: string): string | null {
        return this.teamClusterIdsBySocketId.get(socketId) ?? null;
    }

    async command(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload,
        options?: TeamClusterCommandOptions
    ): Promise<TeamClusterDaemonSocketResponsePayload> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();

        return this.createPendingPromise({
            correlationId: requestId,
            entryType: 'response',
            timeoutMs: options?.timeoutMs ?? this.requestTimeoutMs,
            timeoutMessage: 'Timed out waiting for daemon response',
            createEntry: (resolve, reject, timeout) => ({
                type: 'response',
                socketId,
                timeout,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.emitCommand(socketId, requestId, payload);
            }
        });
    }

    async openStream(teamClusterId: string, payload: TeamClusterDaemonCommandPayload): Promise<PassThrough> {
        const attachment = await this.openCommandStream(teamClusterId, payload);
        return attachment.stream;
    }

    async openCommandStream(teamClusterId: string, payload: TeamClusterDaemonCommandPayload): Promise<TeamClusterReverseChannelStreamAttachment> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();
        const stream = this.createBufferedStream();

        return this.createPendingPromise({
            correlationId: requestId,
            entryType: 'stream',
            timeoutMs: this.requestTimeoutMs,
            timeoutMessage: 'Timed out waiting for daemon stream response',
            createEntry: (resolve, reject, timeout) => ({
                type: 'stream',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.emitCommand(socketId, requestId, {
                    command: payload.command,
                    payload: payload.payload,
                    responseType: TeamClusterDaemonResponseType.Stream
                });
            }
        });
    }

    async attachWebSocket(
        teamClusterId: string,
        targetUrl: string,
        protocols?: string[]
    ): Promise<TeamClusterReverseWebSocketStream> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new TeamClusterReverseWebSocketStream((message) => {
            this.emitSessionInput(socketId, sessionId, message.data, message.isBinary);
        }, () => {
            this.detachSession(sessionId);
        });

        return this.createPendingPromise({
            correlationId: sessionId,
            entryType: 'websocket',
            timeoutMs: this.terminalTimeoutMs,
            timeoutMessage: 'Timed out waiting for daemon websocket attachment',
            createEntry: (resolve, reject, timeout) => ({
                type: 'websocket',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.emitSessionAttachCommand(socketId, sessionId, {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.WebSocket,
                    targetUrl,
                    ...(protocols && protocols.length > 0 ? { protocols } : {})
                });
            }
        });
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.attachTerminalSession(teamClusterId, 'Timed out waiting for daemon terminal attachment', {
            kind: TeamClusterDaemonSessionKind.Terminal,
            containerId
        });
    }

    async openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessModeOrOptions?: TeamClusterServiceExposureAccessMode | TeamClusterTunnelOpenOptions,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterTunnelStream> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const tunnelOptions = typeof target === 'string'
            ? options
            : accessModeOrOptions as TeamClusterTunnelOpenOptions | undefined;
        const accessMode = typeof target === 'string'
            ? accessModeOrOptions as TeamClusterServiceExposureAccessMode | undefined
            : undefined;
        const openPayload = this.createTunnelOpenPayload(sessionId, target, accessMode);

        const stream = new TeamClusterReverseTunnelStream({
            onWrite: (chunk, callback) => {
                this.emitTunnelData(socketId, sessionId, chunk.data, chunk.isBinary, callback);
            },
            onClose: () => {
                this.closeTunnel(sessionId);
            }
        });

        return this.createPendingPromise({
            correlationId: sessionId,
            entryType: 'tunnel',
            timeoutMs: tunnelOptions?.timeoutMs ?? this.terminalTimeoutMs,
            timeoutMessage: tunnelOptions?.timeoutMessage ?? 'Timed out waiting for daemon tunnel attachment',
            createEntry: (resolve, reject, timeout) => ({
                type: 'tunnel',
                socketId,
                timeout,
                stream,
                resolve,
                reject,
                nextWriteSequence: 0,
                pendingWriteAcks: new Map(),
                pendingWriteBytes: 0
            }),
            emitMessage: () => {
                this.emitToDaemon(socketId, openPayload);
            }
        });
    }

    private async attachTerminalSession(
        teamClusterId: string,
        timeoutMessage: string,
        attachPayload: Omit<TeamClusterDaemonSessionAttachPayload, 'sessionId'>
    ): Promise<ContainerTerminalAttachment> {
        const socketId = await this.requireDaemonSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = this.createBufferedStream();

        return this.createPendingPromise({
            correlationId: sessionId,
            entryType: 'terminal',
            timeoutMs: this.terminalTimeoutMs,
            timeoutMessage,
            createEntry: (resolve, reject, timeout) => ({
                type: 'terminal',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.emitSessionAttachCommand(socketId, sessionId, {
                    sessionId,
                    ...attachPayload
                });
            }
        });
    }

    handleMessage(socketId: string, payload: TeamClusterDaemonMessage): void {
        if (!this.isRegisteredDaemonSocket(socketId)) {
            return;
        }

        switch (payload.type) {
            case 'exposure-snapshot': {
                const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
                if (!teamClusterId) {
                    return;
                }

                this.handleExposureSnapshotPayload(teamClusterId, payload);
                return;
            }

            case 'response':
                this.handleResponsePayload(payload);
                return;

            case 'stream':
                this.handleStreamChunkPayload(payload);
                return;

            case 'stream-end':
                this.handleStreamStatePayload(payload);
                return;

            case 'session-data':
                this.handleSessionDataPayload(payload);
                return;

            case 'session-end':
                this.handleSessionEndPayload(payload);
                return;

            case 'tunnel-state':
                this.handleTunnelStatePayload(payload);
                return;

            case 'tunnel-data':
                this.handleTunnelDataPayload(payload);
                return;

            case 'tunnel-drain':
                this.handleTunnelDrainPayload(payload);
                return;

            case 'tunnel-close':
                this.handleTunnelClosePayload(payload);
                return;

            case 'runtime-progress':
                this.handleRuntimeProgressPayload(socketId, payload).catch(() => {
                    logger.error(`[ReverseChannel] Runtime progress handling failed socketId=${socketId}`);
                });
                return;

            default:
                return;
        }
    }

    private async handleRuntimeProgressPayload(
        socketId: string,
        payload: TeamClusterDaemonRuntimeProgressPayload
    ): Promise<void> {
        const readPayloadString = (value: unknown): string | undefined => {
            return typeof value === 'string' ? value : undefined;
        };
        const teamClusterId = this.teamClusterIdsBySocketId.get(socketId);
        if (!teamClusterId) {
            return;
        }

        if (payload.action !== 'container-create') {
            return;
        }

        const operationId = readPayloadString(payload.payload?.operationId);

        if (!operationId) {
            return;
        }

        await this.containerDeploymentProgressService.emitToTeam({
            operationId,
            teamClusterId,
            stage: payload.stage,
            step: readPayloadString(payload.payload?.step),
            image: readPayloadString(payload.payload?.image),
            containerName: readPayloadString(payload.payload?.containerName),
            containerId: readPayloadString(payload.payload?.containerId),
            timestamp: payload.timestamp
        });
    }

    private detachSession(sessionId: string): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || (entry.type !== 'terminal' && entry.type !== 'websocket')) {
            return;
        }

        const detachPayload: TeamClusterDaemonSessionDetachPayload = {
            type: 'session-detach',
            sessionId
        };
        this.emitToDaemon(entry.socketId, detachPayload);

        if (entry.type === 'terminal') {
            entry.stream.destroy();
        }
        this.pendingEntries.delete(sessionId);
        this.untouchSession(sessionId);
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
        this.emitToDaemon(entry.socketId, closePayload);
        this.failPendingTunnelWrites(entry, new Error('Tunnel session closed'));
        this.pendingEntries.delete(sessionId);
        this.untouchSession(sessionId);
    }

    private handleResponsePayload(payload: TeamClusterDaemonSocketResponsePayload): void {
        const entry = this.pendingEntries.get(payload.requestId);
        if (!entry) {
            return;
        }

        switch (entry.type) {
            case 'response':
                this.pendingEntries.delete(payload.requestId);
                this.clearTimeout(entry.timeout);
                entry.resolve(payload);
                return;

            case 'stream':
                this.handleStreamOpenResponse(payload, entry);
                return;

            case 'terminal':
            case 'websocket':
                this.handleSessionAttachResponse(payload, entry);
                return;

            default:
                return;
        }
    }

    private handleStreamOpenResponse(
        payload: TeamClusterDaemonSocketResponsePayload,
        entry: PendingStreamEntry
    ): void {
        this.clearTimeout(entry.timeout);
        entry.timeout = null;

        if (!payload.ok) {
            this.pendingEntries.delete(payload.requestId);
            this.untouchSession(payload.requestId);
            entry.reject(new ApplicationError(
                ErrorCodes.TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED,
                payload.message || 'Daemon stream request failed',
                {
                    statusCode: payload.status,
                    headers: payload.headers || {}
                }
            ));
            return;
        }

        entry.streamId = payload.streamId || payload.requestId;
        this.touchSession(payload.requestId);
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
            this.touchSession(payload.requestId);
            entry.resolve(this.createTerminalAttachment(entry, payload.requestId));
            return;
        }

        this.touchSession(payload.requestId);
        entry.stream.protocol = readSelectedWebSocketProtocol(payload.data);
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

        this.touchSession(payload.requestId);
        const chunk = this.unwrapEnvelopeBuffer(payload.chunk);
        if (!entry.stream.write(chunk)) {
            // Backpressure: stream buffer is full.  We log once but do not
            // accumulate — Node's PassThrough will buffer up to highWaterMark
            // and then start returning false.  The daemon side does not support
            // pause/resume yet, so we accept the write but note the pressure.
            logger.debug(`[ReverseChannel] Stream backpressure hit requestId=${payload.requestId}`);
        }
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
        this.untouchSession(payload.requestId);
    }

    private handleExposureSnapshotPayload(teamClusterId: string, payload: TeamClusterDaemonExposureSnapshotPayload): void {
        this.exposureRegistryService.replaceTeamClusterExposures(teamClusterId, payload.exposures);
    }

    private handleSessionDataPayload(payload: TeamClusterDaemonSessionDataPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry) {
            return;
        }

        this.touchSession(payload.sessionId);
        const chunk = this.unwrapEnvelopeBuffer(payload.chunk);

        if (entry.type === 'terminal') {
            entry.stream.write(chunk);
            return;
        }

        if (entry.type === 'websocket') {
            entry.stream.emitData({
                data: chunk,
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

        switch (entry.type) {
            case 'terminal':
                this.handleTerminalSessionEnd(payload, entry, error);
                return;

            case 'websocket':
                this.handleWebSocketSessionEnd(payload, entry, error);
                return;

            default:
                return;
        }
    }

    private handleTerminalSessionEnd(
        payload: TeamClusterDaemonSessionEndPayload,
        entry: PendingTerminalEntry,
        error?: Error
    ): void {
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
        this.untouchSession(payload.sessionId);
    }

    private handleWebSocketSessionEnd(
        payload: TeamClusterDaemonSessionEndPayload,
        entry: PendingWebSocketEntry,
        error?: Error
    ): void {
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
        this.untouchSession(payload.sessionId);
    }

    private createTerminalAttachment(entry: PendingTerminalEntry, sessionId: string): ContainerTerminalAttachment {
        return {
            exec: new TeamClusterReverseTerminalExec((size) => {
                this.emitSessionResize(entry.socketId, sessionId, size);
            }),
            stream: new TeamClusterReverseTerminalStream(entry.stream, (input) => {
                this.emitSessionInput(entry.socketId, sessionId, Buffer.from(input, 'utf8'), false);
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
                this.failPendingTunnelWrites(entry, error || new Error(payload.message || 'Failed to open daemon tunnel'));
                this.pendingEntries.delete(payload.sessionId);
                this.untouchSession(payload.sessionId);
                entry.reject(error || new Error(payload.message || 'Failed to open daemon tunnel'));
                return;
            }

            entry.resolve(entry.stream);
            this.touchSession(payload.sessionId);
            return;
        }

        if (error) {
            this.failPendingTunnelWrites(entry, error);
            entry.stream.fail(error);
        } else if (payload.status === TeamClusterTunnelSessionStatus.Closed) {
            this.failPendingTunnelWrites(entry, new Error(payload.message || 'Tunnel session closed'));
            entry.stream.closeRemote();
        }

        this.pendingEntries.delete(payload.sessionId);
        this.untouchSession(payload.sessionId);
    }

    private handleTunnelDataPayload(payload: TeamClusterDaemonTunnelDataPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        this.touchSession(payload.sessionId);
        const chunk = this.unwrapEnvelopeBuffer(payload.chunk);
        if (payload.requiresAck && typeof payload.sequence === 'number') {
            entry.stream.pushChunk(chunk, () => {
                this.emitTunnelDrain(entry.socketId, payload.sessionId, payload.sequence!);
            });
            return;
        }

        entry.stream.pushChunk(chunk);
    }

    private handleTunnelDrainPayload(payload: TeamClusterDaemonTunnelDrainPayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        const pendingAck = entry.pendingWriteAcks.get(payload.sequence);
        if (!pendingAck) {
            return;
        }

        this.touchSession(payload.sessionId);
        clearTimeout(pendingAck.timeout);
        entry.pendingWriteAcks.delete(payload.sequence);
        entry.pendingWriteBytes = Math.max(0, entry.pendingWriteBytes - pendingAck.bytes);

        if (entry.blockedWriteCallback && entry.pendingWriteBytes <= TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES) {
            const callback = entry.blockedWriteCallback;
            entry.blockedWriteCallback = undefined;
            callback();
        }
    }

    private handleTunnelClosePayload(payload: TeamClusterDaemonTunnelClosePayload): void {
        const entry = this.pendingEntries.get(payload.sessionId);
        if (!entry || entry.type !== 'tunnel') {
            return;
        }

        // destroy() after closeRemote() so http.Agent evicts the dead socket from its pool.
        this.failPendingTunnelWrites(entry, new Error(payload.message || 'Tunnel session closed'));
        entry.stream.closeRemote();
        entry.stream.destroy();
        this.pendingEntries.delete(payload.sessionId);
        this.untouchSession(payload.sessionId);
    }

    private clearTimeout(timeout: NodeJS.Timeout | null): void {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    private createBufferedStream(): PassThrough {
        return new PassThrough({ highWaterMark: this.streamHighWaterMark });
    }

    private createPendingPromise<TResult, TEntry extends PendingEntry>(options: PendingPromiseOptions<TResult, TEntry>): Promise<TResult> {
        return new Promise((resolve, reject) => {
            const timeout = this.createPendingTimeout(
                options.correlationId,
                options.entryType,
                options.timeoutMs,
                options.timeoutMessage
            );

            this.pendingEntries.set(
                options.correlationId,
                options.createEntry(resolve, reject, timeout)
            );

            options.emitMessage();
        });
    }

    private createPendingTimeout(
        correlationId: string,
        entryType: PendingEntry['type'],
        timeoutMs: number,
        timeoutMessage: string
    ): NodeJS.Timeout {
        return setTimeout(() => {
            const entry = this.pendingEntries.get(correlationId);
            if (!entry || entry.type !== entryType) {
                return;
            }

            this.rejectPendingEntry(correlationId, entry, new Error(timeoutMessage));
        }, timeoutMs);
    }

    private emitToDaemon(socketId: string, payload: TeamClusterDaemonMessage): void {
        this.socketEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, payload);
    }

    private emitCommand(socketId: string, requestId: string, payload: TeamClusterDaemonCommandPayload): void {
        this.emitToDaemon(socketId, this.createCommandMessage(requestId, payload));
    }

    private emitSessionAttachCommand(
        socketId: string,
        sessionId: string,
        payload: TeamClusterDaemonSessionAttachPayload
    ): void {
        this.emitCommand(socketId, sessionId, {
            command: 'session.attach',
            responseType: TeamClusterDaemonResponseType.Json,
            payload
        });
    }

    private emitSessionInput(
        socketId: string,
        sessionId: string,
        chunk: Buffer,
        isBinary: boolean
    ): void {
        const payload: TeamClusterDaemonSessionInputPayload = {
            type: 'session-input',
            sessionId,
            chunk: this.wrapEnvelopeBuffer(chunk),
            isBinary
        };

        this.emitToDaemon(socketId, payload);
    }

    private emitSessionResize(socketId: string, sessionId: string, size: ContainerTerminalSize): void {
        const payload: TeamClusterDaemonSessionResizePayload = {
            type: 'session-resize',
            sessionId,
            rows: size.rows,
            cols: size.cols
        };

        this.emitToDaemon(socketId, payload);
    }

    private emitTunnelData(
        socketId: string,
        sessionId: string,
        chunk: Buffer,
        isBinary: boolean,
        callback: (error?: Error | null) => void
    ): void {
        const entry = this.pendingEntries.get(sessionId);
        if (!entry || entry.type !== 'tunnel') {
            callback(new Error('Tunnel session is not open'));
            return;
        }

        const sequence = ++entry.nextWriteSequence;
        const bytes = chunk.byteLength;
        const timeout = setTimeout(() => {
            const activeEntry = this.pendingEntries.get(sessionId);
            if (!activeEntry || activeEntry.type !== 'tunnel') {
                return;
            }

            const pendingAck = activeEntry.pendingWriteAcks.get(sequence);
            if (!pendingAck) {
                return;
            }

            activeEntry.pendingWriteAcks.delete(sequence);
            activeEntry.pendingWriteBytes = Math.max(0, activeEntry.pendingWriteBytes - pendingAck.bytes);
            const error = new Error(`Timed out waiting for tunnel drain acknowledgement after ${TUNNEL_DRAIN_TIMEOUT_MS}ms`);
            this.failPendingTunnelWrites(activeEntry, error);
            activeEntry.stream.fail(error);
            this.closeTunnel(sessionId);
        }, TUNNEL_DRAIN_TIMEOUT_MS);
        timeout.unref();

        entry.pendingWriteAcks.set(sequence, { bytes, timeout });
        entry.pendingWriteBytes += bytes;

        const payload: TeamClusterDaemonTunnelDataPayload = {
            type: 'tunnel-data',
            sessionId,
            chunk: this.wrapEnvelopeBuffer(chunk),
            isBinary,
            sequence,
            requiresAck: true
        };

        this.emitToDaemon(socketId, payload);

        if (entry.pendingWriteBytes <= TUNNEL_FLOW_CONTROL_WINDOW_BYTES) {
            callback();
            return;
        }

        entry.blockedWriteCallback = callback;
    }

    private emitTunnelDrain(socketId: string, sessionId: string, sequence: number): void {
        const payload: TeamClusterDaemonTunnelDrainPayload = {
            type: 'tunnel-drain',
            sessionId,
            sequence
        };

        this.emitToDaemon(socketId, payload);
    }

    /**
     * Wraps a raw byte buffer into a `StreamChunk` envelope for the reverse
     * channel. Envelope overhead is 10 B per chunk.
     */
    private wrapEnvelopeBuffer(chunk: Buffer | Uint8Array): Uint8Array {
        // Buffer IS a Uint8Array subclass; encodeEnvelope only needs a
        // Uint8Array view so no conversion is required.
        return encodeEnvelope(0, EnvelopeKind.StreamChunk, chunk);
    }

    /**
     * Unwraps a binary envelope into a `Buffer` safe for stream writes.
     * Performs a single memcpy only when the inbound value is not already a
     * `Uint8Array` or the envelope kind does not match the carrier contract.
     */
    private unwrapEnvelopeBuffer(chunk: Uint8Array | Buffer | ArrayBuffer): Buffer {
        const bytes = toUint8Array(chunk);
        const decoded = decodeEnvelope(bytes);
        if (decoded.kind !== EnvelopeKind.StreamChunk) {
            throw ApplicationError.internalServerError(
                `Unexpected reverse channel envelope kind: ${decoded.kind}`
            );
        }
        return Buffer.from(decoded.payload.buffer, decoded.payload.byteOffset, decoded.payload.byteLength);
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
            payload: payload.payload ? { ...payload.payload } : undefined
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
            this.connectionWaiters.get(teamClusterId)!.push(onConnected);
        });
    }

    private failPendingTunnelWrites(entry: PendingTunnelEntry, error: Error): void {
        for (const pendingAck of entry.pendingWriteAcks.values()) {
            clearTimeout(pendingAck.timeout);
        }

        entry.pendingWriteAcks.clear();
        entry.pendingWriteBytes = 0;

        if (!entry.blockedWriteCallback) {
            return;
        }

        const callback = entry.blockedWriteCallback;
        entry.blockedWriteCallback = undefined;
        callback(error);
    }

    private rejectPendingEntry(correlationId: string, entry: PendingEntry, error: Error): void {
        this.pendingEntries.delete(correlationId);
        this.untouchSession(correlationId);
        this.clearTimeout(entry.timeout);

        if (entry.timeout) {
            entry.reject(error);
            return;
        }

        switch (entry.type) {
            case 'response':
                entry.reject(error);
                return;

            case 'terminal':
                entry.stream.emit('error', error);
                entry.stream.destroy();
                return;

            case 'websocket':
                entry.stream.emitError(error);
                entry.stream.destroy();
                return;

            case 'tunnel':
                this.failPendingTunnelWrites(entry, error);
                entry.stream.fail(error);
                return;

            case 'stream':
                entry.stream.emit('error', error);
                entry.stream.destroy();
                entry.reject(error);
                return;

            default:
                return;
        }
    }
}
