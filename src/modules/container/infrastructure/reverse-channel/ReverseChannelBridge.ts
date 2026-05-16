import { TTLCache } from '@isaacs/ttlcache';
import { Service } from '@/core/decorators/service';
import { createTraceLogContext, extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import { logger } from '@/core/logger';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import type {
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload
} from '@voltstack/daemon-cluster-client';
import type {
    BinarySessionDataPayload,
    BinarySessionInputPayload,
    BinaryTunnelDrainPayload,
    BinaryTunnelDataPayload
} from '@/core/reverse-channel/contracts/binary-messages';
import type {
    ReverseChannelCommandResult,
    ReverseChannelCommandExecutor,
    ReverseChannelCommandPayloadView
} from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import { SESSION_ATTACH_TIMEOUT_MS } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import {
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope,
    toUint8Array,
    type DecodedEnvelope
} from '@/core/reverse-channel/contracts/binary-envelope';
import { TeamClusterServiceExposureAccessMode } from '@/core/runtime/contracts/service-exposure';
import { TerminalSessionManager } from '@/modules/container/application/sessions/TerminalSessionManager';
import { WebSocketSessionManager } from '@/modules/container/application/sessions/WebSocketSessionManager';
import { OBJECT_GATEWAY_EXPOSURE } from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import ApplicationError from '@/app/coordination/ApplicationError';
import net from 'node:net';
import type { DaemonExposureRegistry } from '@/modules/container/application/access/DaemonExposureRegistry';
import type { ObjectGatewayTelemetry } from '@/core/observability/infrastructure/ObjectGatewayTelemetry';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import type {
    CommandResult,
    HandlerContext,
    ReverseChannelHandler,
    TeamClusterDaemonMessage as InboundTeamClusterDaemonMessage
} from '@voltstack/daemon-cluster-client';

interface ReverseChannelTunnelState {
    transitionId: number;
    socket: net.Socket;
    isOpen: boolean;
    isObjectGatewayTunnel: boolean;
    nextOutboundSequence: number;
    pendingOutboundAcks: Map<number, PendingTunnelAck>;
    pendingOutboundBytes: number;
    isOutboundPaused: boolean;
    isClosePending: boolean;
    onConnect: () => void;
    onData: (chunk: Buffer) => void;
    onError: (error: Error) => void;
    onClose: () => void;
    onTimeout: () => void;
};

interface SessionTransition {
    sessionId: string;
    transitionId: number;
};

interface RegisteredReverseChannelCommand {
    commandName: string;
    execute: ReverseChannelCommandExecutor;
}

type UnsupportedSessionAttachPayload = Pick<TeamClusterDaemonSessionAttachPayload, 'sessionId'> & {
    kind: string;
};

type ParsedSessionAttachPayload =
    | TeamClusterDaemonSessionAttachPayload
    | UnsupportedSessionAttachPayload;

type DirectTunnelOpenPayload = {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: string;
};

type InboundTunnelOpenPayload = TeamClusterDaemonTunnelOpenPayload | DirectTunnelOpenPayload;

type OutboundBridgeMessage =
    | BinarySessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonTunnelStatePayload
    | BinaryTunnelDataPayload
    | BinaryTunnelDrainPayload
    | TeamClusterDaemonTunnelClosePayload;

type InboundBridgeMessage = InboundTeamClusterDaemonMessage | BinaryTunnelDrainPayload;
type InboundMessageHandler = (message: InboundBridgeMessage) => void;
type SessionAttachHandler = (payload: TeamClusterDaemonSessionAttachPayload) => Promise<ReverseChannelCommandResult>;

interface ReverseChannelMessageTransport {
    emitMessage(message: OutboundBridgeMessage): void;
}

interface ReverseChannelInboundTransport extends ReverseChannelMessageTransport {
    onMessage(listener: (message: unknown) => void): void;
    onDisconnected?(listener: () => void): void;
}

const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;
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

interface PendingTunnelAck {
    bytes: number;
    timeout: NodeJS.Timeout;
}

@Service('reverseChannelBridge')
export class ReverseChannelBridge {
    private readonly tunnelStates = new Map<string, ReverseChannelTunnelState>();
    private readonly attachingSessionIds = new Map<string, number>();
    private readonly cancelledSessionTransitions = new Set<number>();
    private readonly terminalSessionManager: TerminalSessionManager;
    private readonly webSocketSessionManager: WebSocketSessionManager;
    private nextSessionTransitionId = 0;

    private readonly sessionActivity = new TTLCache<string, true>({
        ttl: SESSION_IDLE_TTL_MS,
        updateAgeOnGet: true,
        checkAgeOnGet: true,
        checkAgeOnHas: true,
        dispose: (_value, sessionId, reason) => {
            if (reason !== 'stale') {
                return;
            }

            logger.warn(`Session idle TTL expired — cleaning up sessionId=${sessionId}`);
            this.cleanupInteractiveSession(sessionId);
        }
    });

    private readonly pendingCommands: RegisteredReverseChannelCommand[] = [];
    private voltCloudConnection: VoltCloudConnection | null = null;
    private objectGatewayConnection: ReverseChannelInboundTransport | null = null;
    private readonly tunnelTransports = new Map<string, ReverseChannelMessageTransport>();
    private readonly inboundMessageHandlers: Partial<Record<string, InboundMessageHandler>> = {
        'session-input': (message) => this.handleSessionInput(message as unknown as BinarySessionInputPayload),
        'session-resize': (message) => this.handleSessionResize(message as TeamClusterDaemonSessionResizePayload),
        'session-detach': (message) => this.handleSessionDetach(message as { sessionId: string }),
        'tunnel-data': (message) => this.handleTunnelData(message as unknown as BinaryTunnelDataPayload),
        'tunnel-drain': (message) => this.handleTunnelDrain(message as unknown as BinaryTunnelDrainPayload),
        'tunnel-close': (message) => this.handleTunnelClose(message as { sessionId: string })
    };
    private readonly sessionAttachHandlers: Partial<Record<TeamClusterDaemonSessionAttachPayload['kind'], SessionAttachHandler>> = {
        [REVERSE_CHANNEL.SessionKind.Terminal]: (payload) => this.terminalSessionManager.attachSession(payload),
        [REVERSE_CHANNEL.SessionKind.WebSocket]: (payload) => this.webSocketSessionManager.attachSession(payload)
    };

    constructor(
        private readonly dockerRuntime?: DockerRuntime,
        private readonly objectGatewayTelemetry?: ObjectGatewayTelemetry,
        private readonly daemonExposureRegistry?: DaemonExposureRegistry
    ) {
        const sharedCoordinator = {
            beginSessionTransition: this.beginSessionTransition.bind(this),
            cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
            clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
            emitSessionData: this.emitMessage.bind(this),
            emitSessionEnd: this.emitMessage.bind(this),
            endSessionTransition: this.endSessionTransition.bind(this),
            touchSession: this.touchSession.bind(this)
        };
        this.terminalSessionManager = new TerminalSessionManager({
            dockerRuntime: this.dockerRuntime,
            coordinator: {
                ...sharedCoordinator,
                wasSessionTransitionCancelled: (transition) => this.cancelledSessionTransitions.has(transition.transitionId)
            }
        });
        this.webSocketSessionManager = new WebSocketSessionManager({
            coordinator: sharedCoordinator
        });

        this.registerCommand('session.attach', (payload) => this.attachSession(payload as ParsedSessionAttachPayload));
    }

    registerCommand(commandName: string, execute: ReverseChannelCommandExecutor): void {
        if (this.voltCloudConnection) {
            this.voltCloudConnection.client.registerHandler(
                commandName,
                this.createCommandHandler(commandName, execute)
            );
            return;
        }

        this.pendingCommands.push({ commandName, execute });
    }

    bindToClient(voltCloudConnection: VoltCloudConnection): void {
        this.voltCloudConnection = voltCloudConnection;

        for (const command of this.pendingCommands) {
            voltCloudConnection.client.registerHandler(
                command.commandName,
                this.createCommandHandler(command.commandName, command.execute)
            );
        }

        voltCloudConnection.client
            .onMessage((message) => {
                this.routeInboundMessage(
                    message as unknown as InboundBridgeMessage,
                    voltCloudConnection as unknown as ReverseChannelMessageTransport
                );
            })
            .onDisconnected(() => {
                this.cleanup();
            });
    }

    bindObjectGatewayConnection(connection: ReverseChannelInboundTransport): void {
        this.objectGatewayConnection = connection;
        connection.onMessage((message) => {
            this.routeInboundMessage(message as InboundBridgeMessage, connection);
        });
        connection.onDisconnected?.(() => {
            for (const [sessionId, transport] of this.tunnelTransports.entries()) {
                if (transport === connection) {
                    this.cleanupTunnelSession(sessionId);
                }
            }
        });
    }

    private createCommandHandler(
        commandName: string,
        execute: ReverseChannelCommandExecutor
    ): ReverseChannelHandler {
        return {
            handle: async (payload, ctx): Promise<CommandResult> => {
                const commandPayloadView = payload as ReverseChannelCommandPayloadView | undefined;
                const requestId = this.resolveCommandRequestId(commandPayloadView, ctx);
                const commandLogContext = {
                    requestId,
                    ...createTraceLogContext(extractDaemonTraceContext(commandPayloadView))
                };

                try {
                    const result = await execute(payload as object | undefined);
                    return {
                        status: result.status,
                        data: result.data,
                        body: result.body,
                        headers: result.headers,
                        stream: result.stream
                    };
                } catch (error) {
                    if (error instanceof ApplicationError) {
                        logger.warn('Daemon command rejected');
                        return {
                            status: error.statusCode,
                            data: {
                                status: 'error',
                                code: error.code,
                                message: error.message
                            }
                        };
                    }

                    const unhandledError = error instanceof Error
                        ? error
                        : new Error('An unexpected error occurred');
                    logger.error(
                        {
                            command: commandName,
                            code: 'INTERNAL_ERROR',
                            message: unhandledError.message,
                            stack: unhandledError.stack,
                            ...commandLogContext
                        },
                        'Daemon command failed with unhandled exception'
                    );
                    return {
                        status: 500,
                        data: {
                            status: 'error',
                            code: 'INTERNAL_ERROR',
                            message: unhandledError.message
                        }
                    };
                }
            }
        };
    }

    private resolveCommandRequestId(
        payload: ReverseChannelCommandPayloadView | undefined,
        ctx?: HandlerContext
    ): string | undefined {
        return ctx?.requestId ?? payload?.requestId;
    }

    private touchSession(sessionId: string): void {
        this.sessionActivity.set(sessionId, true);
    }

    private beginSessionTransition(sessionId: string): SessionTransition | null {
        if (this.attachingSessionIds.has(sessionId)) {
            return null;
        }

        const transitionId = ++this.nextSessionTransitionId;
        this.attachingSessionIds.set(sessionId, transitionId);
        return {
            sessionId,
            transitionId
        };
    }

    private endSessionTransition(transition: SessionTransition): void {
        this.cancelledSessionTransitions.delete(transition.transitionId);

        if (this.attachingSessionIds.get(transition.sessionId) !== transition.transitionId) {
            return;
        }

        this.attachingSessionIds.delete(transition.sessionId);
    }

    private cancelSessionTransition(sessionId: string): void {
        const transitionId = this.attachingSessionIds.get(sessionId);
        if (transitionId === undefined) {
            return;
        }

        this.cancelledSessionTransitions.add(transitionId);
    }

    private clearSessionActivityIfUntracked(sessionId: string): void {
        if (this.terminalSessionManager.terminalStates.has(sessionId)) return;
        if (this.webSocketSessionManager.webSocketStates.has(sessionId)) return;
        if (this.tunnelStates.has(sessionId)) return;
        this.sessionActivity.delete(sessionId);
    }

    private cleanupInteractiveSession(sessionId: string): void {
        this.terminalSessionManager.cleanupSession(sessionId);
        this.webSocketSessionManager.cleanupSession(sessionId);
        this.cleanupTunnelSession(sessionId);
    }

    cleanup(): void {
        for (const sessionId of this.attachingSessionIds.keys()) {
            this.cancelSessionTransition(sessionId);
        }

        for (const sessionId of this.terminalSessionManager.terminalStates.keys()) {
            this.cleanupInteractiveSession(sessionId);
        }

        for (const sessionId of this.webSocketSessionManager.webSocketStates.keys()) {
            this.cleanupInteractiveSession(sessionId);
        }

        for (const sessionId of Array.from(this.tunnelStates.keys())) {
            this.cleanupInteractiveSession(sessionId);
        }

        this.sessionActivity.clear();
        this.tunnelTransports.clear();
    }

    private routeInboundMessage(
        message: InboundBridgeMessage,
        transport: ReverseChannelMessageTransport
    ): void {
        const bridgeMessage = message as unknown as InboundBridgeMessage;
        if (bridgeMessage.type === 'tunnel-open') {
            this.handleTunnelOpen(bridgeMessage as unknown as InboundTunnelOpenPayload, transport);
            return;
        }

        this.inboundMessageHandlers[bridgeMessage.type]?.(bridgeMessage);
    }

    attachSession(payload: ParsedSessionAttachPayload): Promise<ReverseChannelCommandResult> {
        const attachSession = this.sessionAttachHandlers[payload.kind as TeamClusterDaemonSessionAttachPayload['kind']];
        if (attachSession) {
            return attachSession(payload as TeamClusterDaemonSessionAttachPayload);
        }

        return Promise.resolve({
            status: 400,
            data: { status: 'error', message: `Unsupported session kind: ${payload.kind}` }
        });
    }

    private handleSessionInput(message: BinarySessionInputPayload): void {
        if (this.terminalSessionManager.handleInput(message)) {
            return;
        }

        if (!this.webSocketSessionManager.handleInput(message)) {
            this.sessionActivity.delete(message.sessionId);
        }
    }

    private handleSessionResize(message: TeamClusterDaemonSessionResizePayload): void {
        this.terminalSessionManager.handleResize(message);
    }

    private handleSessionDetach(message: { sessionId: string }): void {
        this.cancelSessionTransition(message.sessionId);
        this.cleanupInteractiveSession(message.sessionId);
    }

    private handleTunnelClose(message: { sessionId: string }): void {
        this.cleanupTunnelSession(message.sessionId);
    }

    private handleTunnelOpen(
        payload: InboundTunnelOpenPayload,
        transport: ReverseChannelMessageTransport
    ): void {
        const sessionTransition = this.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            this.closeTunnelWithError(payload.sessionId, 'Tunnel session is already opening');
            return;
        }

        let targetHost: string;
        let targetPort: number;
        const isObjectGatewayTunnel = 'exposureId' in payload
            && payload.exposureId === OBJECT_GATEWAY_EXPOSURE.id;
        const tunnelOpenStartedAt = Date.now();

        this.cleanupInteractiveSession(payload.sessionId);
        this.tunnelTransports.set(payload.sessionId, transport);

        if ('targetHost' in payload) {
            targetHost = payload.targetHost;
            targetPort = payload.targetPort;
        } else {
            const exposure = this.daemonExposureRegistry?.getExposure(payload.exposureId);

            if (!exposure) {
                this.closeTunnelWithError(payload.sessionId, 'Exposure not found', sessionTransition);
                return;
            }

            if (!exposure.accessModes.some(mode => mode === payload.accessMode)) {
                this.closeTunnelWithError(payload.sessionId, 'Exposure access mode is not supported', sessionTransition);
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
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (tunnelState) {
                tunnelState.isOpen = true;
            }

            tunnelSocket.setTimeout(0);
            this.endSessionTransition(sessionTransition);
            if (isObjectGatewayTunnel) {
                this.objectGatewayTelemetry?.recordObjectTunnelOpened(Date.now() - tunnelOpenStartedAt);
            }
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Open
            });
        };
        const onData = (chunk: Buffer) => {
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (!tunnelState) {
                return;
            }

            this.emitTunnelData(
                payload.sessionId,
                tunnelState,
                chunk,
                payload.accessMode !== TeamClusterServiceExposureAccessMode.Http
            );
        };
        const onError = (error: Error) => {
            this.closeTunnelWithError(payload.sessionId, error.message, sessionTransition);
        };
        const onTimeout = () => {
            this.closeTunnelWithError(payload.sessionId, 'Tunnel session timed out while opening', sessionTransition);
        };
        const onClose = () => {
            this.completeTunnelClose(payload.sessionId, sessionTransition);
        };

        tunnelSocket.on('connect', onConnect);
        tunnelSocket.on('data', onData);
        tunnelSocket.on('error', onError);
        tunnelSocket.on('close', onClose);
        tunnelSocket.setTimeout(SESSION_ATTACH_TIMEOUT_MS, onTimeout);

        this.tunnelStates.set(payload.sessionId, {
            transitionId: sessionTransition.transitionId,
            socket: tunnelSocket,
            isOpen: false,
            isObjectGatewayTunnel,
            nextOutboundSequence: 0,
            pendingOutboundAcks: new Map(),
            pendingOutboundBytes: 0,
            isOutboundPaused: false,
            isClosePending: false,
            onConnect,
            onData,
            onError,
            onClose,
            onTimeout
        });
        this.touchSession(payload.sessionId);

        this.emitTunnelState({
            type: 'tunnel-state',
            sessionId: payload.sessionId,
            status: REVERSE_CHANNEL.TunnelSessionStatus.Opening
        });
    }

    private handleTunnelData(payload: BinaryTunnelDataPayload): void {
        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            this.sessionActivity.delete(payload.sessionId);
            return;
        }

        let envelopeBytes: Uint8Array;
        try {
            envelopeBytes = toUint8Array(payload.chunk);
        } catch (error) {
            this.closeTunnelWithError(
                payload.sessionId,
                `Malformed tunnel envelope: ${error instanceof Error ? error.message : String(error)}`
            );
            return;
        }

        let decoded: DecodedEnvelope;
        try {
            decoded = decodeEnvelope(envelopeBytes);
        } catch (error) {
            this.closeTunnelWithError(
                payload.sessionId,
                `Malformed tunnel envelope: ${error instanceof Error ? error.message : String(error)}`
            );
            return;
        }

        if (decoded.kind !== EnvelopeKind.StreamChunk) {
            this.closeTunnelWithError(payload.sessionId, `Unexpected tunnel envelope kind: ${decoded.kind}`);
            return;
        }

        this.touchSession(payload.sessionId);
        const chunk = Buffer.from(decoded.payload.buffer, decoded.payload.byteOffset, decoded.payload.byteLength);
        if (payload.requiresAck && typeof payload.sequence === 'number') {
            let acknowledged = false;
            const acknowledgeDrain = (): void => {
                if (acknowledged) {
                    return;
                }

                acknowledged = true;
                this.emitTunnelDrain(payload.sessionId, payload.sequence!);
            };
            const isReadyForMore = tunnelState.socket.write(chunk, (error?: Error | null) => {
                if (error) {
                    this.closeTunnelWithError(payload.sessionId, error.message);
                    return;
                }

                acknowledgeDrain();
            });

            if (isReadyForMore) {
                acknowledgeDrain();
            } else {
                tunnelState.socket.once('drain', acknowledgeDrain);
            }
            return;
        }

        tunnelState.socket.write(chunk);
    }

    private handleTunnelDrain(payload: BinaryTunnelDrainPayload): void {
        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            this.sessionActivity.delete(payload.sessionId);
            return;
        }

        const pendingAck = tunnelState.pendingOutboundAcks.get(payload.sequence);
        if (!pendingAck) {
            return;
        }

        this.touchSession(payload.sessionId);
        clearTimeout(pendingAck.timeout);
        tunnelState.pendingOutboundAcks.delete(payload.sequence);
        tunnelState.pendingOutboundBytes = Math.max(0, tunnelState.pendingOutboundBytes - pendingAck.bytes);

        if (
            tunnelState.isOutboundPaused
            && tunnelState.pendingOutboundBytes <= TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES
            && !tunnelState.socket.destroyed
        ) {
            tunnelState.isOutboundPaused = false;
            tunnelState.socket.resume();
        }

        if (tunnelState.isClosePending && tunnelState.pendingOutboundAcks.size === 0) {
            this.completeTunnelClose(payload.sessionId);
        }
    }

    private emitMessage(message: OutboundBridgeMessage): void {
        this.voltCloudConnection?.emitMessage(message as unknown as Parameters<VoltCloudConnection['emitMessage']>[0]);
    }

    private emitTunnelMessage(sessionId: string, message: OutboundBridgeMessage): void {
        const transport = this.tunnelTransports.get(sessionId);
        transport?.emitMessage(message);
    }

    private emitTunnelData(
        sessionId: string,
        tunnelState: ReverseChannelTunnelState,
        chunk: Buffer,
        isBinary: boolean
    ): void {
        this.touchSession(sessionId);
        const sequence = ++tunnelState.nextOutboundSequence;
        const envelope = encodeEnvelope(
            0,
            EnvelopeKind.StreamChunk,
            chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );
        const bytes = chunk.byteLength;
        const timeout = setTimeout(() => {
            const activeTunnelState = this.tunnelStates.get(sessionId);
            if (!activeTunnelState) {
                return;
            }

            const pendingAck = activeTunnelState.pendingOutboundAcks.get(sequence);
            if (!pendingAck) {
                return;
            }

            activeTunnelState.pendingOutboundAcks.delete(sequence);
            activeTunnelState.pendingOutboundBytes = Math.max(0, activeTunnelState.pendingOutboundBytes - pendingAck.bytes);
            this.closeTunnelWithError(
                sessionId,
                `Timed out waiting for tunnel drain acknowledgement after ${TUNNEL_DRAIN_TIMEOUT_MS}ms`
            );
        }, TUNNEL_DRAIN_TIMEOUT_MS);
        timeout.unref();

        tunnelState.pendingOutboundAcks.set(sequence, { bytes, timeout });
        tunnelState.pendingOutboundBytes += bytes;

        const dataPayload: BinaryTunnelDataPayload = {
            type: 'tunnel-data',
            sessionId,
            chunk: envelope,
            isBinary,
            sequence,
            requiresAck: true
        };
        this.emitTunnelMessage(sessionId, dataPayload);

        if (
            tunnelState.pendingOutboundBytes > TUNNEL_FLOW_CONTROL_WINDOW_BYTES
            && !tunnelState.isOutboundPaused
            && !tunnelState.socket.destroyed
        ) {
            tunnelState.isOutboundPaused = true;
            tunnelState.socket.pause();
        }
    }

    private emitTunnelDrain(sessionId: string, sequence: number): void {
        this.emitTunnelMessage(sessionId, {
            type: 'tunnel-drain',
            sessionId,
            sequence
        });
    }

    private emitTunnelState(payload: TeamClusterDaemonTunnelStatePayload): void {
        this.emitTunnelMessage(payload.sessionId, payload);
    }

    private closeTunnelWithError(sessionId: string, error: string, transition?: SessionTransition): void {
        if (transition) this.endSessionTransition(transition);
        this.emitTunnelState({
            type: 'tunnel-state',
            sessionId,
            status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
            error
        });
        this.cleanupTunnelSession(sessionId);
    }

    private completeTunnelClose(sessionId: string, transition?: SessionTransition): void {
        if (transition) this.endSessionTransition(transition);

        const tunnelState = this.tunnelStates.get(sessionId);
        if (!tunnelState) {
            return;
        }

        if (tunnelState.pendingOutboundAcks.size > 0) {
            tunnelState.isClosePending = true;
            return;
        }

        const closePayload: TeamClusterDaemonTunnelClosePayload = {
            type: 'tunnel-close',
            sessionId
        };
        this.emitTunnelMessage(sessionId, closePayload);
        this.cleanupTunnelSession(sessionId);
    }

    private cleanupTunnelSession(sessionId: string): void {
        const tunnelState = this.tunnelStates.get(sessionId);
        if (!tunnelState) {
            this.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        if (!tunnelState.isOpen) {
            this.endSessionTransition({
                sessionId,
                transitionId: tunnelState.transitionId
            });
        }

        tunnelState.socket.removeListener('connect', tunnelState.onConnect);
        tunnelState.socket.removeListener('data', tunnelState.onData);
        tunnelState.socket.removeListener('error', tunnelState.onError);
        tunnelState.socket.removeListener('close', tunnelState.onClose);
        tunnelState.socket.removeListener('timeout', tunnelState.onTimeout);

        this.clearPendingTunnelAcks(tunnelState);

        if (!tunnelState.socket.destroyed) {
            tunnelState.socket.destroy();
        }

        if (tunnelState.isObjectGatewayTunnel && tunnelState.isOpen) {
            this.objectGatewayTelemetry?.recordObjectTunnelClosed();
        }

        this.tunnelStates.delete(sessionId);
        this.tunnelTransports.delete(sessionId);
        this.clearSessionActivityIfUntracked(sessionId);
    }

    private clearPendingTunnelAcks(tunnelState: ReverseChannelTunnelState): void {
        for (const pendingAck of tunnelState.pendingOutboundAcks.values()) {
            clearTimeout(pendingAck.timeout);
        }

        tunnelState.pendingOutboundAcks.clear();
        tunnelState.pendingOutboundBytes = 0;
        tunnelState.isOutboundPaused = false;
    }
}
