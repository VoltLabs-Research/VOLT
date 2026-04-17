import { TTLCache } from '@isaacs/ttlcache';
import { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import { logger } from '@/core/logger';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import type {
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload
} from '@/core/reverse-channel/contracts/reverseChannel.socket';
import { adaptReverseChannelHandler } from '@/core/reverse-channel/infrastructure/reverseChannelCommandAdapter';
import type { ReverseChannelCommandExecutor } from '@/core/reverse-channel/contracts/commandHandler';
import { BASE64_SESSION_CHUNK_PATTERN, SESSION_ATTACH_TIMEOUT_MS } from '@/core/reverse-channel/contracts/reverseChannelSessionConstants';
import { readTunnelOpenPayload } from '@/core/reverse-channel/infrastructure/reverseChannelTunnelOpen';
import { TeamClusterServiceExposureAccessMode } from '@/core/runtime/contracts/serviceExposure';
import { TerminalSessionManager } from '@/modules/container/application/sessions/TerminalSessionManager';
import { WebSocketSessionManager } from '@/modules/container/application/sessions/WebSocketSessionManager';
import { isTerminalSessionAttachPayload, isWebSocketSessionAttachPayload, readSessionAttachPayload } from '@/core/reverse-channel/infrastructure/reverseChannelSessionAttach';
import { OBJECT_GATEWAY_EXPOSURE } from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import { BinaryRelaySocketBridge } from '@/modules/container/infrastructure/relay/BinaryRelaySocketBridge';
import net from 'node:net';
import type { DaemonExposureRegistryService } from '@/modules/container/application/access/DaemonExposureRegistryService';
import type { ObjectGatewayTelemetryService } from '@/core/observability/infrastructure/ObjectGatewayTelemetryService';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import type { CommandResult, TeamClusterDaemonMessage as InboundTeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';

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

type OutboundBridgeMessage =
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelClosePayload;

const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;

export class ReverseChannelSocketBridge {
    private readonly tunnelStates = new Map<string, ReverseChannelTunnelState>();
    private readonly attachingSessionIds = new Map<string, number>();
    private readonly cancelledSessionTransitions = new Set<number>();
    private readonly terminalSessionManager: TerminalSessionManager;
    private readonly webSocketSessionManager: WebSocketSessionManager;
    private readonly binaryRelaySocketBridge: BinaryRelaySocketBridge;
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

            logger.warn({ sessionId }, 'Session idle TTL expired — cleaning up');
            this.cleanupInteractiveSession(sessionId);
        }
    });

    private readonly pendingCommands: RegisteredReverseChannelCommand[] = [];
    private voltCloudConnection: VoltCloudConnection | null = null;

    constructor(
        private readonly dockerRuntimeService?: DockerRuntimeService,
        private readonly objectGatewayTelemetryService?: ObjectGatewayTelemetryService,
        private readonly daemonExposureRegistryService?: DaemonExposureRegistryService
    ) {
        this.terminalSessionManager = new TerminalSessionManager({
            dockerRuntimeService: this.dockerRuntimeService,
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
        this.binaryRelaySocketBridge = new BinaryRelaySocketBridge({
            emitTunnelClose: this.emitMessage.bind(this),
            emitTunnelState: this.emitTunnelState.bind(this),
            touchSession: this.touchSession.bind(this),
            clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
            endSessionTransition: this.endSessionTransition.bind(this),
            wasSessionTransitionCancelled: (transition) => this.cancelledSessionTransitions.has(transition.transitionId)
        }, this.objectGatewayTelemetryService);
    }

    registerCommand(commandName: string, execute: ReverseChannelCommandExecutor): void {
        if (this.voltCloudConnection) {
            this.voltCloudConnection.client.registerHandler(
                commandName,
                adaptReverseChannelHandler(commandName, execute)
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
                adaptReverseChannelHandler(command.commandName, command.execute)
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
        if (this.binaryRelaySocketBridge.sessions.has(sessionId)) return;
        this.sessionActivity.delete(sessionId);
    }

    private cleanupInteractiveSession(sessionId: string): void {
        this.terminalSessionManager.cleanupSession(sessionId);
        this.webSocketSessionManager.cleanupSession(sessionId);
        this.cleanupTunnelSession(sessionId);
        this.binaryRelaySocketBridge.cleanupSession(sessionId, {
            emitTunnelClose: false
        });
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

        for (const sessionId of this.binaryRelaySocketBridge.sessions.keys()) {
            this.cleanupInteractiveSession(sessionId);
        }

        this.sessionActivity.clear();
    }

    private routeInboundMessage(message: InboundTeamClusterDaemonMessage): void {
        if (message.type === 'session-input') {
            if (this.terminalSessionManager.handleInput(message)) {
                return;
            }

            if (!this.webSocketSessionManager.handleInput(message)) {
                this.sessionActivity.delete(message.sessionId);
            }
            return;
        }

        if (message.type === 'session-resize') {
            this.terminalSessionManager.handleResize(message);
            return;
        }

        if (message.type === 'session-detach') {
            this.cancelSessionTransition(message.sessionId);
            this.cleanupInteractiveSession(message.sessionId);
            return;
        }

        if (message.type === 'tunnel-open') {
            const tunnelOpenPayload = readTunnelOpenPayload(message);
            this.handleTunnelOpen(tunnelOpenPayload);
            return;
        }

        if (message.type === 'tunnel-data') {
            this.handleTunnelData(message);
            return;
        }

        if (message.type === 'tunnel-close') {
            this.cleanupTunnelSession(message.sessionId);
        }
    }

    attachSession(payload: object | undefined): Promise<CommandResult> {
        const attachPayload = readSessionAttachPayload(payload);

        if (isTerminalSessionAttachPayload(attachPayload)) {
            return this.terminalSessionManager.attachSession(attachPayload);
        }

        if (isWebSocketSessionAttachPayload(attachPayload)) {
            return this.webSocketSessionManager.attachSession(attachPayload);
        }

        return Promise.resolve({
            status: 400,
            data: { status: 'error', message: `Unsupported session kind: ${attachPayload.kind}` }
        });
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
            const exposure = this.daemonExposureRegistryService?.getExposure(payload.exposureId);

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

        if (payload.relay) {
            this.binaryRelaySocketBridge.openTunnel({
                sessionId: payload.sessionId,
                transition: sessionTransition,
                relay: payload.relay,
                targetHost,
                targetPort,
                isObjectGatewayTunnel
            });
            this.touchSession(payload.sessionId);
            this.emitTunnelState({
                type: 'tunnel-state',
                sessionId: payload.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Opening
            });
            return;
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
            this.objectGatewayTelemetryService?.recordObjectTunnelClosed();
        }

        this.tunnelStates.delete(sessionId);
        this.clearSessionActivityIfUntracked(sessionId);
    }
}
