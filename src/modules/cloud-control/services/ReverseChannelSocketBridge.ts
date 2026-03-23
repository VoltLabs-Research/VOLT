import { REVERSE_CHANNEL, TeamClusterServiceExposureAccessMode } from '@/shared/contracts';
import { DockerRuntimeService, HostShellService } from '@/modules/platform/services';
import { logger } from '@/core/logger';
import { adaptReverseChannelHandler, isCommandPayloadRecord } from './reverseChannelCommandAdapter';
import { TerminalSessionManager } from './TerminalSessionManager';
import { WebSocketSessionManager } from './WebSocketSessionManager';
import {
    isTerminalSessionAttachPayload,
    isWebSocketSessionAttachPayload,
    readSessionAttachPayload
} from './reverseChannelSessionAttach';
import { BASE64_SESSION_CHUNK_PATTERN, SESSION_ATTACH_TIMEOUT_MS } from './reverseChannelSessionConstants';
import { readTunnelOpenPayload } from './reverseChannelTunnelOpen';
import { OBJECT_GATEWAY_EXPOSURE } from './ObjectGatewayServer';
import net from 'node:net';
import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload
} from '@/shared/contracts';
import type { DaemonExposureRegistryService } from './DaemonExposureRegistryService';
import type { ObjectGatewayTelemetryService } from './ObjectGatewayTelemetryService';
import type { VoltCloudConnection } from './VoltCloudConnection';
import type { ReverseChannelCommandHandler } from './reverseChannelCommandAdapter';
import type {
    CommandResult,
    TeamClusterDaemonMessage as InboundTeamClusterDaemonMessage
} from '@voltstack/daemon-cluster-client';

export type { ReverseChannelCommandHandler, ReverseChannelCommandResult } from './reverseChannelCommandAdapter';

interface ReverseChannelTunnelState {
    sessionId: string;
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

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

type OutboundBridgeMessage =
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelClosePayload;

/**
 * How long a session can remain idle (no data sent/received) before it is
 * automatically cleaned up. Prevents orphaned sessions from leaking memory.
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
    private readonly tunnelStates = new Map<string, ReverseChannelTunnelState>();
    private readonly attachingSessionIds = new Map<string, number>();
    private readonly cancelledSessionTransitions = new Set<number>();
    private readonly terminalSessionManager: TerminalSessionManager;
    private readonly webSocketSessionManager: WebSocketSessionManager;
    private nextSessionTransitionId = 0;

    /** Tracks last activity timestamp per session for idle TTL. */
    private readonly sessionActivity = new Map<string, number>();
    private idleSweepTimer: ReturnType<typeof setInterval> | null = null;

    /** Buffered handlers registered before `bindToClient` is called. */
    private readonly pendingHandlers: ReverseChannelCommandHandler[] = [];
    private voltCloudConnection: VoltCloudConnection | null = null;
    private exposureRegistryService?: DaemonExposureRegistryService;

    constructor(
        private readonly dockerRuntimeService?: DockerRuntimeService,
        private readonly hostShellService?: HostShellService,
        private readonly objectGatewayTelemetryService?: ObjectGatewayTelemetryService
    ) {
        this.terminalSessionManager = new TerminalSessionManager({
            dockerRuntimeService: this.dockerRuntimeService,
            hostShellService: this.hostShellService,
            coordinator: {
                beginSessionTransition: this.beginSessionTransition.bind(this),
                cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
                clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
                emitSessionData: this.emitMessage.bind(this),
                emitSessionEnd: this.emitSessionEnd.bind(this),
                endSessionTransition: this.endSessionTransition.bind(this),
                touchSession: this.touchSession.bind(this),
                wasSessionTransitionCancelled: this.wasSessionTransitionCancelled.bind(this)
            }
        });
        this.webSocketSessionManager = new WebSocketSessionManager({
            coordinator: {
                beginSessionTransition: this.beginSessionTransition.bind(this),
                cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
                clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
                emitSessionData: this.emitMessage.bind(this),
                emitSessionEnd: this.emitSessionEnd.bind(this),
                endSessionTransition: this.endSessionTransition.bind(this),
                touchSession: this.touchSession.bind(this)
            }
        });
    }

    /**
     * Registers a command handler. If called before `bindToClient`, the handler
     * is buffered and registered once `bindToClient` is invoked.
     */
    registerHandler(handler: ReverseChannelCommandHandler): void {
        if (this.voltCloudConnection) {
            this.voltCloudConnection.client.registerHandler(
                handler.command,
                adaptReverseChannelHandler(handler)
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
                adaptReverseChannelHandler(handler)
            );
        }

        voltCloudConnection.client.registerHandler('session.attach', {
            handle: async (payload, _ctx) => {
                return this.handleSessionAttach(isCommandPayloadRecord(payload) ? payload : undefined);
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
        if (typeof transitionId === 'number') {
            this.cancelledSessionTransitions.add(transitionId);
        }
    }

    private wasSessionTransitionCancelled(transition: SessionTransition): boolean {
        return this.cancelledSessionTransitions.has(transition.transitionId);
    }

    private clearSessionActivityIfUntracked(sessionId: string): void {
        if (
            !this.terminalSessionManager.hasSession(sessionId)
            && !this.webSocketSessionManager.hasSession(sessionId)
            && !this.tunnelStates.has(sessionId)
        ) {
            this.sessionActivity.delete(sessionId);
        }
    }

    private cleanupInteractiveSession(sessionId: string): void {
        this.terminalSessionManager.cleanupSession(sessionId);
        this.webSocketSessionManager.cleanupSession(sessionId);
        this.cleanupTunnelSession(sessionId);
    }

    /**
     * Starts a periodic sweep that cleans up sessions idle beyond SESSION_IDLE_TTL_MS.
     */
    private startIdleSweep(): void {
        if (this.idleSweepTimer) {
            return;
        }

        this.idleSweepTimer = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, lastActive] of this.sessionActivity) {
                if (now - lastActive > SESSION_IDLE_TTL_MS) {
                    logger.warn({ sessionId }, 'Session idle TTL expired — cleaning up');
                    this.cleanupInteractiveSession(sessionId);
                }
            }
        }, SESSION_SWEEP_INTERVAL_MS);
        this.idleSweepTimer.unref();
    }

    cleanup(): void {
        for (const sessionId of this.attachingSessionIds.keys()) {
            this.cancelSessionTransition(sessionId);
        }

        for (const sessionId of this.terminalSessionManager.getSessionIds()) {
            this.cleanupInteractiveSession(sessionId);
        }

        for (const sessionId of this.webSocketSessionManager.getSessionIds()) {
            this.cleanupInteractiveSession(sessionId);
        }

        for (const sessionId of Array.from(this.tunnelStates.keys())) {
            this.cleanupInteractiveSession(sessionId);
        }

        this.sessionActivity.clear();

        if (this.idleSweepTimer) {
            clearInterval(this.idleSweepTimer);
            this.idleSweepTimer = null;
        }
    }

    private routeInboundMessage(message: InboundTeamClusterDaemonMessage): void {
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
            const tunnelOpenPayload = readTunnelOpenPayload(message);
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

    private async handleSessionAttach(
        payload: Record<string, unknown> | undefined
    ): Promise<CommandResult> {
        const attachPayload = readSessionAttachPayload(payload);

        if (!attachPayload) {
            return {
                status: 400,
                data: { status: 'error', message: 'Invalid session.attach payload' }
            };
        }

        if (isTerminalSessionAttachPayload(attachPayload)) {
            return this.attachTerminal(attachPayload);
        }

        if (isWebSocketSessionAttachPayload(attachPayload)) {
            return this.attachWebSocket(attachPayload);
        }

        return {
            status: 400,
            data: { status: 'error', message: `Unsupported session kind: ${attachPayload.kind}` }
        };
    }

    private async attachTerminal(payload: TeamClusterDaemonSessionAttachPayload): Promise<CommandResult> {
        return this.terminalSessionManager.attachSession(payload);
    }

    private async attachWebSocket(payload: TeamClusterDaemonSessionAttachPayload): Promise<CommandResult> {
        return this.webSocketSessionManager.attachSession(payload);
    }

    private handleSessionInput(payload: TeamClusterDaemonSessionInputPayload): void {
        if (this.terminalSessionManager.handleInput(payload)) {
            return;
        }

        if (!this.webSocketSessionManager.handleInput(payload)) {
            this.sessionActivity.delete(payload.sessionId);
        }
    }

    private handleSessionResize(payload: TeamClusterDaemonSessionResizePayload): void {
        this.terminalSessionManager.handleResize(payload);
    }

    private handleSessionDetach(payload: { sessionId: string }): void {
        this.cancelSessionTransition(payload.sessionId);
        this.cleanupInteractiveSession(payload.sessionId);
    }

    private handleTunnelOpen(payload: LocalTeamClusterDaemonTunnelOpenPayload): void {
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
            const exposure = this.exposureRegistryService?.getExposure(payload.exposureId);

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
                this.objectGatewayTelemetryService?.recordObjectTunnelOpened(Date.now() - tunnelOpenStartedAt);
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
            sessionId: payload.sessionId,
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

    private handleTunnelClose(payload: TeamClusterDaemonTunnelClosePayload): void {
        this.cleanupTunnelSession(payload.sessionId);
    }

    private emitMessage(message: OutboundBridgeMessage): void {
        this.voltCloudConnection?.emitMessage(message);
    }

    private emitSessionEnd(payload: TeamClusterDaemonSessionEndPayload): void {
        this.emitMessage(payload);
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
            this.objectGatewayTelemetryService?.recordObjectTunnelClosed();
        }

        this.tunnelStates.delete(sessionId);
        this.clearSessionActivityIfUntracked(sessionId);
    }
}
