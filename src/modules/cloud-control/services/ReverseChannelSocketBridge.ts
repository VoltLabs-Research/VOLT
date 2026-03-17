import { DockerRuntimeService, HostShellService } from '@/modules/platform/services';
import { EmptyFilterResultError } from '@/modules/trajectory-native/services';
import { REVERSE_CHANNEL, TeamClusterServiceExposureAccessMode } from '@/shared/contracts';
import { logger } from '@/core/logger';
import type { RuntimeTerminalAttachment } from '@/modules/platform/services';
import type {
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonSocketHeaders
} from '@/shared/contracts';
import net from 'node:net';
import type { DaemonExposureRegistryService } from './DaemonExposureRegistryService';
import type { VoltCloudConnection } from './VoltCloudConnection';
import type {
    ReverseChannelHandler,
    CommandResult,
    TeamClusterDaemonMessage,
    TeamClusterDaemonTunnelOpenPayload as InboundTeamClusterDaemonTunnelOpenPayload
} from '@voltstack/daemon-cluster-client';

export interface ReverseChannelCommandHandler {
    command: string;
    execute: (payload: Record<string, unknown> | undefined) => Promise<ReverseChannelCommandResult>;
};

export interface ReverseChannelCommandResult {
    status?: number;
    data?: unknown;
    body?: Buffer;
    headers?: TeamClusterDaemonSocketHeaders;
    stream?: ReadableStream<Uint8Array>;
};

interface WebSocketMessageResult {
    data: Buffer;
    isBinary: boolean;
};

interface ReverseChannelTerminalState {
    sessionId: string;
    attachment: RuntimeTerminalAttachment;
    onData: (chunk: Buffer) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
};

interface ReverseChannelWebSocketState {
    sessionId: string;
    socket: WebSocket;
    onMessage: (event: MessageEvent) => void;
    onError: () => void;
    onClose: (event: CloseEvent) => void;
};

interface ReverseChannelTunnelState {
    sessionId: string;
    socket: net.Socket;
    onConnect: () => void;
    onData: (chunk: Buffer) => void;
    onError: (error: Error) => void;
    onClose: () => void;
};

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

/**
 * How long a session can remain idle (no data sent/received) before it is
 * automatically cleaned up.  Prevents orphaned sessions from leaking memory.
 */
const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;

/**
 * How often to sweep for idle sessions.
 */
const SESSION_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Manages interactive session (terminal, WebSocket, tunnel) lifecycle for the
 * reverse channel. Command dispatch is delegated to the SDK's `ReverseChannelBridge`
 * via `ClusterDaemonClient`; this class registers its handlers and subscribes to
 * non-command inbound messages through `VoltCloudConnection`.
 *
 * Call `bindToClient(voltCloudConnection)` once after creating both objects.
 */
export class ReverseChannelSocketBridge {
    private readonly terminalStates = new Map<string, ReverseChannelTerminalState>();
    private readonly webSocketStates = new Map<string, ReverseChannelWebSocketState>();
    private readonly tunnelStates = new Map<string, ReverseChannelTunnelState>();
    private readonly sessionGenerations = new Map<string, number>();

    /** Tracks last activity timestamp per session for idle TTL. */
    private readonly sessionActivity = new Map<string, number>();
    private idleSweepTimer: ReturnType<typeof setInterval> | null = null;

    /** Buffered handlers registered before `bindToClient` is called. */
    private readonly pendingHandlers: ReverseChannelCommandHandler[] = [];
    private voltCloudConnection: VoltCloudConnection | null = null;
    private exposureRegistryService?: DaemonExposureRegistryService;

    constructor(
        private readonly dockerRuntimeService?: DockerRuntimeService,
        private readonly hostShellService?: HostShellService
    ) {}

    /**
     * Registers a command handler. If called before `bindToClient`, the handler
     * is buffered and registered once `bindToClient` is invoked.
     */
    registerHandler(handler: ReverseChannelCommandHandler): void {
        if (this.voltCloudConnection) {
            this.voltCloudConnection.client.registerHandler(
                handler.command,
                this.adaptHandler(handler)
            );
            return;
        }

        this.pendingHandlers.push(handler);
    }

    setExposureRegistryService(exposureRegistryService: DaemonExposureRegistryService): void {
        this.exposureRegistryService = exposureRegistryService;
    }

    /**
     * Connects this bridge to the SDK client via `VoltCloudConnection`.
     *
     * - Registers all buffered command handlers on the client's bridge.
     * - Registers the `session.attach` command handler.
     * - Subscribes to inbound non-command messages for session/tunnel management.
     * - Subscribes to disconnect events for cleanup.
     */
    bindToClient(voltCloudConnection: VoltCloudConnection): void {
        this.voltCloudConnection = voltCloudConnection;

        for (const handler of this.pendingHandlers) {
            voltCloudConnection.client.registerHandler(
                handler.command,
                this.adaptHandler(handler)
            );
        }

        voltCloudConnection.client.registerHandler('session.attach', {
            handle: async (payload, _ctx) => {
                return this.handleSessionAttach(payload as Record<string, unknown> | undefined);
            }
        });

        voltCloudConnection.client
            .onMessage((message) => {
                this.routeInboundMessage(message);
            })
            .onDisconnected(() => {
                this.cleanup();
            });

        this.startIdleSweep();
    }

    /**
     * Records activity for a session so the idle TTL resets.
     */
    private touchSession(sessionId: string): void {
        this.sessionActivity.set(sessionId, Date.now());
    }

    private beginSession(sessionId: string): number {
        this.cleanupSession(sessionId);

        const nextGeneration = (this.sessionGenerations.get(sessionId) || 0) + 1;
        this.sessionGenerations.set(sessionId, nextGeneration);
        this.touchSession(sessionId);
        return nextGeneration;
    }

    private isCurrentSessionGeneration(sessionId: string, generation: number): boolean {
        return this.sessionGenerations.get(sessionId) === generation;
    }

    private cleanupSession(sessionId: string): void {
        this.cleanupTerminalSession(sessionId);
        this.cleanupWebSocketSession(sessionId);
        this.cleanupTunnelSession(sessionId);
        this.finalizeSessionTracking(sessionId);
    }

    private finalizeSessionTracking(sessionId: string): void {
        if (this.terminalStates.has(sessionId) || this.webSocketStates.has(sessionId) || this.tunnelStates.has(sessionId)) {
            return;
        }

        this.sessionActivity.delete(sessionId);
        this.sessionGenerations.delete(sessionId);
    }

    /**
     * Starts a periodic sweep that cleans up sessions idle beyond SESSION_IDLE_TTL_MS.
     */
    private startIdleSweep(): void {
        if (this.idleSweepTimer) return;

        this.idleSweepTimer = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, lastActive] of this.sessionActivity) {
                if (now - lastActive > SESSION_IDLE_TTL_MS) {
                    logger.warn({ sessionId }, 'Session idle TTL expired — cleaning up');
                    this.cleanupSession(sessionId);
                    // sessionActivity is cleaned up in the individual cleanup methods
                }
            }
        }, SESSION_SWEEP_INTERVAL_MS);
        this.idleSweepTimer.unref();
    }

    cleanup(): void {
        const sessionIds = new Set<string>([
            ...this.terminalStates.keys(),
            ...this.webSocketStates.keys(),
            ...this.tunnelStates.keys()
        ]);

        for (const sessionId of sessionIds) {
            this.cleanupSession(sessionId);
        }

        this.sessionActivity.clear();
        this.sessionGenerations.clear();

        if (this.idleSweepTimer) {
            clearInterval(this.idleSweepTimer);
            this.idleSweepTimer = null;
        }
    }

    private routeInboundMessage(message: TeamClusterDaemonMessage): void {
        if (message.type === 'session-input') {
            this.handleSessionInput(message);
            return;
        }

        if (message.type === 'session-resize') {
            this.handleSessionResize(message);
            return;
        }

        if (message.type === 'session-detach') {
            this.handleSessionDetach(message);
            return;
        }

        if (message.type === 'tunnel-open') {
            const tunnelOpenPayload = this.validateTunnelOpenPayload(message);
            if (!tunnelOpenPayload) {
                this.emitTunnelState({
                    type: 'tunnel-state',
                    sessionId: message.sessionId,
                    status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                    error: 'Invalid tunnel-open payload'
                });
                return;
            }

            this.handleTunnelOpen(tunnelOpenPayload);
            return;
        }

        if (message.type === 'tunnel-data') {
            this.handleTunnelData(message);
            return;
        }

        if (message.type === 'tunnel-close') {
            this.handleTunnelClose(message);
        }
    }

    private adaptHandler(handler: ReverseChannelCommandHandler): ReverseChannelHandler {
        return {
            handle: async (payload, _ctx): Promise<CommandResult> => {
                try {
                    const result = await handler.execute(payload as Record<string, unknown> | undefined);
                    return {
                        status: result.status,
                        data: result.data,
                        body: result.body,
                        headers: result.headers,
                        stream: result.stream
                    };
                } catch (error: unknown) {
                    if (error instanceof EmptyFilterResultError) {
                        logger.warn(
                            { command: handler.command, code: error.code, message: error.message },
                            'Daemon command rejected: empty filter result'
                        );
                        return {
                            status: 422,
                            data: {
                                status: 'error',
                                code: error.code,
                                message: error.message
                            }
                        };
                    }

                    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
                    const stack = error instanceof Error ? error.stack : undefined;
                    logger.error(
                        { command: handler.command, code: 'INTERNAL_ERROR', message, stack },
                        'Daemon command failed with unhandled exception'
                    );
                    return {
                        status: 500,
                        data: {
                            status: 'error',
                            code: 'INTERNAL_ERROR',
                            message
                        }
                    };
                }
            }
        };
    }

    private async handleSessionAttach(
        payload: Record<string, unknown> | undefined
    ): Promise<CommandResult> {
        if (!payload || typeof payload.sessionId !== 'string' || typeof payload.kind !== 'string') {
            return {
                status: 400,
                data: { status: 'error', message: 'Invalid session.attach payload' }
            };
        }

        const attachPayload = payload as unknown as TeamClusterDaemonSessionAttachPayload;

        if (attachPayload.kind === REVERSE_CHANNEL.SessionKind.Terminal) {
            return this.attachTerminal(attachPayload);
        }

        if (attachPayload.kind === REVERSE_CHANNEL.SessionKind.WebSocket) {
            return this.attachWebSocket(attachPayload);
        }

        return {
            status: 400,
            data: { status: 'error', message: `Unsupported session kind: ${attachPayload.kind}` }
        };
    }

    private async attachTerminal(payload: TeamClusterDaemonSessionAttachPayload): Promise<CommandResult> {
        if (!this.dockerRuntimeService || !this.hostShellService) {
            this.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'Terminal services are not available'
            });
            return { status: 200, data: { status: 'success', data: { attached: true } } };
        }

        try {
            const sessionGeneration = this.beginSession(payload.sessionId);
            let attachment: RuntimeTerminalAttachment;

            if (payload.terminalTarget === REVERSE_CHANNEL.TerminalTarget.Host) {
                attachment = await this.hostShellService.attachTerminal();
            } else {
                if (!payload.containerId) {
                    this.finalizeSessionTracking(payload.sessionId);
                    this.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: 'containerId is required for container terminal'
                    });
                    return { status: 200, data: { status: 'success', data: { attached: true } } };
                }

                attachment = await this.dockerRuntimeService.attachTerminal(payload.containerId);
            }

            if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                attachment.stream.destroy();
                return { status: 200, data: { status: 'success', data: { attached: true } } };
            }

            const onData = (chunk: Buffer) => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.touchSession(payload.sessionId);
                const dataPayload: TeamClusterDaemonSessionDataPayload = {
                    type: 'session-data',
                    sessionId: payload.sessionId,
                    chunkBase64: chunk.toString('base64'),
                    isBinary: false
                };
                this.emitMessage(dataPayload);
            };
            const onEnd = () => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.emitSessionEnd({ type: 'session-end', sessionId: payload.sessionId });
                this.cleanupTerminalSession(payload.sessionId);
            };
            const onError = (error: Error) => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.emitSessionEnd({
                    type: 'session-end',
                    sessionId: payload.sessionId,
                    error: error.message
                });
                this.cleanupTerminalSession(payload.sessionId);
            };

            attachment.stream.on('data', onData);
            attachment.stream.on('end', onEnd);
            attachment.stream.on('error', onError);

            this.terminalStates.set(payload.sessionId, {
                sessionId: payload.sessionId,
                attachment,
                onData,
                onEnd,
                onError
            });

            return { status: 200, data: { status: 'success', data: { attached: true } } };
        } catch (error: unknown) {
            this.finalizeSessionTracking(payload.sessionId);
            this.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: error instanceof Error ? error.message : 'Failed to attach terminal'
            });
            return { status: 200, data: { status: 'success', data: { attached: true } } };
        }
    }

    private attachWebSocket(payload: TeamClusterDaemonSessionAttachPayload): CommandResult {
        if (!payload.targetUrl) {
            this.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'targetUrl is required'
            });
            return { status: 200, data: { status: 'success', data: { attached: true } } };
        }

        try {
            const sessionGeneration = this.beginSession(payload.sessionId);
            const webSocket = new WebSocket(payload.targetUrl);
            const onMessage = (event: MessageEvent) => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.handleWebSocketMessage(payload.sessionId, event).catch((error: unknown) => {
                    this.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: error instanceof Error ? error.message : 'Failed to proxy websocket message'
                    });
                });
            };
            const onError = () => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.emitSessionEnd({
                    type: 'session-end',
                    sessionId: payload.sessionId,
                    error: 'Reverse channel websocket failed'
                });
                this.cleanupWebSocketSession(payload.sessionId);
            };
            const onClose = (event: CloseEvent) => {
                if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                    return;
                }

                this.emitSessionEnd({
                    type: 'session-end',
                    sessionId: payload.sessionId,
                    code: event.code,
                    message: event.reason || undefined
                });
                this.cleanupWebSocketSession(payload.sessionId);
            };

            webSocket.binaryType = 'arraybuffer';
            webSocket.addEventListener('message', onMessage);
            webSocket.addEventListener('error', onError);
            webSocket.addEventListener('close', onClose);

            this.webSocketStates.set(payload.sessionId, {
                sessionId: payload.sessionId,
                socket: webSocket,
                onMessage,
                onError,
                onClose
            });

            return { status: 200, data: { status: 'success', data: { attached: true } } };
        } catch (error: unknown) {
            this.finalizeSessionTracking(payload.sessionId);
            this.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: error instanceof Error ? error.message : 'Failed to attach websocket'
            });
            return { status: 200, data: { status: 'success', data: { attached: true } } };
        }
    }

    private handleSessionInput(payload: TeamClusterDaemonSessionInputPayload): void {
        this.touchSession(payload.sessionId);

        const terminalState = this.terminalStates.get(payload.sessionId);
        if (terminalState) {
            terminalState.attachment.stream.write(Buffer.from(payload.chunkBase64, 'base64').toString('utf8'));
            return;
        }

        const webSocketState = this.webSocketStates.get(payload.sessionId);
        if (!webSocketState) {
            return;
        }

        if (payload.isBinary) {
            webSocketState.socket.send(Buffer.from(payload.chunkBase64, 'base64'));
            return;
        }

        webSocketState.socket.send(Buffer.from(payload.chunkBase64, 'base64').toString('utf8'));
    }

    private handleSessionResize(payload: TeamClusterDaemonSessionResizePayload): void {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return;
        }

        terminalState.attachment.exec.resize({ rows: payload.rows, cols: payload.cols }).catch(() => {});
    }

    private handleSessionDetach(payload: { sessionId: string }): void {
        this.cleanupSession(payload.sessionId);
    }

    private validateTunnelOpenPayload(
        message: InboundTeamClusterDaemonTunnelOpenPayload
    ): LocalTeamClusterDaemonTunnelOpenPayload | null {
        if (!this.isTunnelAccessMode(message.accessMode)) {
            return null;
        }

        if ('targetHost' in message && 'targetPort' in message) {
            if (
                typeof message.targetHost !== 'string' ||
                message.targetHost.length === 0 ||
                typeof message.targetPort !== 'number' ||
                !Number.isInteger(message.targetPort) ||
                message.targetPort <= 0
            ) {
                return null;
            }

            return {
                type: 'tunnel-open',
                sessionId: message.sessionId,
                targetHost: message.targetHost,
                targetPort: message.targetPort,
                accessMode: message.accessMode
            };
        }

        if ('exposureId' in message) {
            if (typeof message.exposureId !== 'string' || message.exposureId.length === 0) {
                return null;
            }

            return {
                type: 'tunnel-open',
                sessionId: message.sessionId,
                exposureId: message.exposureId,
                accessMode: message.accessMode
            };
        }

        return null;
    }

    private isTunnelAccessMode(value: string): value is TeamClusterServiceExposureAccessMode {
        return Object.values(TeamClusterServiceExposureAccessMode).some(accessMode => accessMode === value);
    }

    private handleTunnelOpen(payload: LocalTeamClusterDaemonTunnelOpenPayload): void {
        const sessionGeneration = this.beginSession(payload.sessionId);
        let targetHost: string;
        let targetPort: number;

        if ('targetHost' in payload) {
            targetHost = payload.targetHost;
            targetPort = payload.targetPort;
        } else {
            const exposure = this.exposureRegistryService?.getExposure(payload.exposureId);

            if (!exposure) {
                this.finalizeSessionTracking(payload.sessionId);
                this.emitTunnelState({
                    type: 'tunnel-state',
                    sessionId: payload.sessionId,
                    status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                    error: 'Exposure not found'
                });
                return;
            }

            if (!exposure.accessModes.some(mode => mode === payload.accessMode)) {
                this.finalizeSessionTracking(payload.sessionId);
                this.emitTunnelState({
                    type: 'tunnel-state',
                    sessionId: payload.sessionId,
                    status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                    error: 'Exposure access mode is not supported'
                });
                return;
            }

            targetHost = exposure.targetHost;
            targetPort = exposure.targetPort;
        }

        const tunnelSocket = net.createConnection({
            host: targetHost,
            port: targetPort
        });
        tunnelSocket.setNoDelay(true);

        const onConnect = () => {
            if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                return;
            }

            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Open
            });
        };
        const onData = (chunk: Buffer) => {
            if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                return;
            }

            this.touchSession(payload.sessionId);
            const dataPayload: TeamClusterDaemonTunnelDataPayload = {
                type: 'tunnel-data',
                sessionId: payload.sessionId,
                chunkBase64: chunk.toString('base64'),
                isBinary: payload.accessMode !== TeamClusterServiceExposureAccessMode.Http
            };
            this.emitMessage(dataPayload);
        };
        const onError = (error: Error) => {
            if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                return;
            }

            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: error.message
            });
            this.cleanupTunnelSession(payload.sessionId);
        };
        const onClose = () => {
            if (!this.isCurrentSessionGeneration(payload.sessionId, sessionGeneration)) {
                return;
            }

            const closePayload: TeamClusterDaemonTunnelClosePayload = {
                type: 'tunnel-close',
                sessionId: payload.sessionId
            };
            this.emitMessage(closePayload);
            this.cleanupTunnelSession(payload.sessionId);
        };

        tunnelSocket.on('connect', onConnect);
        tunnelSocket.on('data', onData);
        tunnelSocket.on('error', onError);
        tunnelSocket.on('close', onClose);

        this.tunnelStates.set(payload.sessionId, {
            sessionId: payload.sessionId,
            socket: tunnelSocket,
            onConnect,
            onData,
            onError,
            onClose
        });

        this.emitTunnelState({
            type: 'tunnel-state',
            sessionId: payload.sessionId,
            status: REVERSE_CHANNEL.TunnelSessionStatus.Opening
        });
    }

    private handleTunnelData(payload: TeamClusterDaemonTunnelDataPayload): void {
        this.touchSession(payload.sessionId);

        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            return;
        }

        tunnelState.socket.write(Buffer.from(payload.chunkBase64, 'base64'));
    }

    private handleTunnelClose(payload: TeamClusterDaemonTunnelClosePayload): void {
        this.cleanupTunnelSession(payload.sessionId);
    }

    private emitMessage(message: NonCommandMessage): void {
        this.voltCloudConnection?.emitMessage(message);
    }

    private emitSessionEnd(payload: TeamClusterDaemonSessionEndPayload): void {
        this.emitMessage(payload);
    }

    private emitTunnelState(payload: TeamClusterDaemonTunnelStatePayload): void {
        this.emitMessage(payload);
    }

    private async handleWebSocketMessage(sessionId: string, event: MessageEvent): Promise<void> {
        const message = await this.readWebSocketMessage(event.data);
        const payload: TeamClusterDaemonSessionDataPayload = {
            type: 'session-data',
            sessionId,
            chunkBase64: message.data.toString('base64'),
            isBinary: message.isBinary
        };
        this.emitMessage(payload);
    }

    private async readWebSocketMessage(data: unknown): Promise<WebSocketMessageResult> {
        if (typeof data === 'string') {
            return { data: Buffer.from(data, 'utf8'), isBinary: false };
        }

        if (data instanceof ArrayBuffer) {
            return { data: Buffer.from(data), isBinary: true };
        }

        if (ArrayBuffer.isView(data)) {
            return {
                data: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
                isBinary: true
            };
        }

        if (data instanceof Blob) {
            return { data: Buffer.from(await data.arrayBuffer()), isBinary: true };
        }

        throw new Error('Unsupported websocket message payload');
    }

    private cleanupTerminalSession(sessionId: string): void {
        const terminalState = this.terminalStates.get(sessionId);
        if (!terminalState) {
            return;
        }

        terminalState.attachment.stream.removeListener('data', terminalState.onData);
        terminalState.attachment.stream.removeListener('end', terminalState.onEnd);
        terminalState.attachment.stream.removeListener('error', terminalState.onError);
        terminalState.attachment.stream.destroy();
        this.terminalStates.delete(sessionId);
        this.finalizeSessionTracking(sessionId);
    }

    private cleanupWebSocketSession(sessionId: string): void {
        const webSocketState = this.webSocketStates.get(sessionId);
        if (!webSocketState) {
            return;
        }

        webSocketState.socket.removeEventListener('message', webSocketState.onMessage);
        webSocketState.socket.removeEventListener('error', webSocketState.onError);
        webSocketState.socket.removeEventListener('close', webSocketState.onClose);

        if (
            webSocketState.socket.readyState === WebSocket.OPEN ||
            webSocketState.socket.readyState === WebSocket.CONNECTING
        ) {
            webSocketState.socket.close();
        }

        this.webSocketStates.delete(sessionId);
        this.finalizeSessionTracking(sessionId);
    }

    private cleanupTunnelSession(sessionId: string): void {
        const tunnelState = this.tunnelStates.get(sessionId);
        if (!tunnelState) {
            return;
        }

        tunnelState.socket.removeListener('connect', tunnelState.onConnect);
        tunnelState.socket.removeListener('data', tunnelState.onData);
        tunnelState.socket.removeListener('error', tunnelState.onError);
        tunnelState.socket.removeListener('close', tunnelState.onClose);

        if (!tunnelState.socket.destroyed) {
            tunnelState.socket.destroy();
        }

        this.tunnelStates.delete(sessionId);
        this.finalizeSessionTracking(sessionId);
    }
};
