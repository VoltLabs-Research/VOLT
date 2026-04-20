import { TTLCache } from '@isaacs/ttlcache';
import { Service } from '@/core/decorators/service';
import { createTraceLogContext, extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import { logger } from '@/core/logger';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import type {
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload
} from '@voltstack/daemon-cluster-client';
import type {
    ReverseChannelCommandExecutor,
    ReverseChannelCommandPayloadView
} from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import { BASE64_SESSION_CHUNK_PATTERN, SESSION_ATTACH_TIMEOUT_MS } from '@/core/reverse-channel/contracts/reverse-channel-constants';
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
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelClosePayload;

type InboundMessageHandler = (message: InboundTeamClusterDaemonMessage) => void;
type SessionAttachHandler = (payload: TeamClusterDaemonSessionAttachPayload) => Promise<CommandResult>;

const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;

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
    private readonly inboundMessageHandlers: Partial<Record<InboundTeamClusterDaemonMessage['type'], InboundMessageHandler>> = {
        'session-input': (message) => this.handleSessionInput(message as TeamClusterDaemonSessionInputPayload),
        'session-resize': (message) => this.handleSessionResize(message as TeamClusterDaemonSessionResizePayload),
        'session-detach': (message) => this.handleSessionDetach(message as { sessionId: string }),
        'tunnel-open': (message) => this.handleTunnelOpen(message as unknown as InboundTunnelOpenPayload),
        'tunnel-data': (message) => this.handleTunnelData(message as TeamClusterDaemonTunnelDataPayload),
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
        this.terminalSessionManager = new TerminalSessionManager({
            dockerRuntime: this.dockerRuntime,
            coordinator: {
                beginSessionTransition: this.beginSessionTransition.bind(this),
                cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
                clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
                emitSessionData: this.emitMessage.bind(this),
                emitSessionEnd: this.emitMessage.bind(this),
                endSessionTransition: this.endSessionTransition.bind(this),
                touchSession: this.touchSession.bind(this),
                wasSessionTransitionCancelled: (transition) => this.cancelledSessionTransitions.has(transition.transitionId)
            }
        });
        this.webSocketSessionManager = new WebSocketSessionManager({
            coordinator: {
                beginSessionTransition: this.beginSessionTransition.bind(this),
                cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
                clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
                emitSessionData: this.emitMessage.bind(this),
                emitSessionEnd: this.emitMessage.bind(this),
                endSessionTransition: this.endSessionTransition.bind(this),
                touchSession: this.touchSession.bind(this)
            }
        });
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
                this.routeInboundMessage(message);
            })
            .onDisconnected(() => {
                this.cleanup();
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
    }

    private routeInboundMessage(message: InboundTeamClusterDaemonMessage): void {
        this.inboundMessageHandlers[message.type]?.(message);
    }

    attachSession(payload: ParsedSessionAttachPayload): Promise<CommandResult> {
        const attachSession = this.sessionAttachHandlers[payload.kind as TeamClusterDaemonSessionAttachPayload['kind']];
        if (attachSession) {
            return attachSession(payload as TeamClusterDaemonSessionAttachPayload);
        }

        return Promise.resolve({
            status: 400,
            data: { status: 'error', message: `Unsupported session kind: ${payload.kind}` }
        });
    }

    private handleSessionInput(message: TeamClusterDaemonSessionInputPayload): void {
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

    private handleTunnelOpen(payload: InboundTunnelOpenPayload): void {
        const sessionTransition = this.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: 'Tunnel session is already opening'
            });
            return;
        }

        let targetHost: string;
        let targetPort: number;
        const isObjectGatewayTunnel = 'exposureId' in payload
            && payload.exposureId === OBJECT_GATEWAY_EXPOSURE.id;
        const tunnelOpenStartedAt = Date.now();

        this.cleanupInteractiveSession(payload.sessionId);

        if ('targetHost' in payload) {
            targetHost = payload.targetHost;
            targetPort = payload.targetPort;
        } else {
            const exposure = this.daemonExposureRegistry?.getExposure(payload.exposureId);

            if (!exposure) {
                this.endSessionTransition(sessionTransition);
                this.emitTunnelState({
                    type: 'tunnel-state',
                    sessionId: payload.sessionId,
                    status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                    error: 'Exposure not found'
                });
                return;
            }

            if (!exposure.accessModes.some(mode => mode === payload.accessMode)) {
                this.endSessionTransition(sessionTransition);
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
            this.endSessionTransition(sessionTransition);
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: error.message
            });
            this.cleanupTunnelSession(payload.sessionId);
        };
        const onTimeout = () => {
            this.endSessionTransition(sessionTransition);
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: 'Tunnel session timed out while opening'
            });
            this.cleanupTunnelSession(payload.sessionId);
        };
        const onClose = () => {
            this.endSessionTransition(sessionTransition);
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
        tunnelSocket.setTimeout(SESSION_ATTACH_TIMEOUT_MS, onTimeout);

        this.tunnelStates.set(payload.sessionId, {
            transitionId: sessionTransition.transitionId,
            socket: tunnelSocket,
            isOpen: false,
            isObjectGatewayTunnel,
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

    private handleTunnelData(payload: TeamClusterDaemonTunnelDataPayload): void {
        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            this.sessionActivity.delete(payload.sessionId);
            return;
        }

        if (!BASE64_SESSION_CHUNK_PATTERN.test(payload.chunkBase64)) {
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: 'Tunnel data is not valid base64 data'
            });
            this.cleanupTunnelSession(payload.sessionId);
            return;
        }

        this.touchSession(payload.sessionId);
        tunnelState.socket.write(Buffer.from(payload.chunkBase64, 'base64'));
    }

    private emitMessage(message: OutboundBridgeMessage): void {
        this.voltCloudConnection?.emitMessage(message);
    }

    private emitTunnelState(payload: TeamClusterDaemonTunnelStatePayload): void {
        this.emitMessage(payload);
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

        if (!tunnelState.socket.destroyed) {
            tunnelState.socket.destroy();
        }

        if (tunnelState.isObjectGatewayTunnel && tunnelState.isOpen) {
            this.objectGatewayTelemetry?.recordObjectTunnelClosed();
        }

        this.tunnelStates.delete(sessionId);
        this.clearSessionActivityIfUntracked(sessionId);
    }
}
