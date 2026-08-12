import { errorMessage } from '@shared/application/utilities/error-message';
import { REVERSE_CHANNEL } from '@core/constants/reverse-channel';
import { SESSION_ATTACH_TIMEOUT_MS } from '@core/constants/reverse-channel';
import { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/service-exposure';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { encodeStreamChunk, decodeStreamChunk } from '@shared/contracts/channel/binary-envelope';
import net from 'node:net';
import type { DaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';
import type { TeamClusterDaemonTunnelOpenPayload, TeamClusterDaemonTunnelStatePayload } from '@voltstack/daemon-cluster-client';
import type {
    BinaryTunnelDataPayload,
    BinaryTunnelDrainPayload,
    DirectTunnelOpenPayload,
    ReverseChannelOutboundMessage
} from '@shared/contracts/channel/binary-messages';
import type { SessionTransition, SessionTransitionCoordinator } from '@modules/container/services/sessions/session-transitions';

type TunnelOpenPayload = TeamClusterDaemonTunnelOpenPayload | DirectTunnelOpenPayload;

export interface TunnelMessageTransport {
    emitMessage(message: ReverseChannelOutboundMessage): void;
}

interface PendingTunnelAck {
    bytes: number;
    timeout: NodeJS.Timeout;
}

interface TunnelState {
    transitionId: number;
    socket: net.Socket;
    isOpen: boolean;
    isClosing: boolean;
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
}

interface TunnelSessionManagerOptions {
    coordinator: SessionTransitionCoordinator;
    daemonExposureRegistry: DaemonExposureRegistry;
}

const TUNNEL_FLOW_CONTROL_WINDOW_BYTES = readPositiveIntegerEnv('TEAM_CLUSTER_REVERSE_TUNNEL_WINDOW_BYTES')
    ?? 8 * 1024 * 1024;
const TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES = Math.max(
    64 * 1024,
    Math.floor(TUNNEL_FLOW_CONTROL_WINDOW_BYTES / 2)
);
const TUNNEL_DRAIN_TIMEOUT_MS = readPositiveIntegerEnv('TEAM_CLUSTER_REVERSE_TUNNEL_DRAIN_TIMEOUT_MS')
    ?? 120_000;

export class TunnelSessionManager {
    readonly tunnelStates = new Map<string, TunnelState>();
    private readonly transports = new Map<string, TunnelMessageTransport>();

    constructor(private readonly options: TunnelSessionManagerOptions) {}

    handleOpen(payload: TunnelOpenPayload, transport: TunnelMessageTransport): void {
        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            this.closeWithError(payload.sessionId, 'Tunnel session is already opening');
            return;
        }

        this.options.coordinator.cleanupInteractiveSession(payload.sessionId);
        this.transports.set(payload.sessionId, transport);

        const target = this.resolveTarget(payload);
        if (typeof target === 'string') {
            this.closeWithError(payload.sessionId, target, sessionTransition);
            return;
        }

        const tunnelSocket = net.createConnection(target);
        tunnelSocket.setNoDelay(true);

        const onConnect = () => {
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (tunnelState) {
                tunnelState.isOpen = true;
            }

            tunnelSocket.setTimeout(0);
            this.options.coordinator.endSessionTransition(sessionTransition);
            this.emitState(payload.sessionId, REVERSE_CHANNEL.TunnelSessionStatus.Open);
        };
        const onData = (chunk: Buffer) => {
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (!tunnelState) {
                return;
            }

            this.emitData(
                payload.sessionId,
                tunnelState,
                chunk,
                payload.accessMode !== TeamClusterServiceExposureAccessMode.Http
            );
        };
        const onError = (error: Error) => {
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (!tunnelState || tunnelState.isClosing) {
                return;
            }
            this.closeWithError(payload.sessionId, error.message, sessionTransition);
        };
        const onTimeout = () => {
            this.closeWithError(payload.sessionId, 'Tunnel session timed out while opening', sessionTransition);
        };
        const onClose = () => {
            const tunnelState = this.tunnelStates.get(payload.sessionId);
            if (!tunnelState || tunnelState.isClosing) {
                return;
            }
            this.completeClose(payload.sessionId, sessionTransition);
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
            isClosing: false,
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
        this.options.coordinator.touchSession(payload.sessionId);
        this.emitState(payload.sessionId, REVERSE_CHANNEL.TunnelSessionStatus.Opening);
    }

    private resolveTarget(payload: TunnelOpenPayload): net.TcpNetConnectOpts | string {
        if ('targetHost' in payload) {
            return {
                host: payload.targetHost,
                port: payload.targetPort
            };
        }

        const exposure = this.options.daemonExposureRegistry.getExposure(payload.exposureId);
        if (!exposure) {
            return 'Exposure not found';
        }

        if (!exposure.accessModes.some((mode) => mode === payload.accessMode)) {
            return 'Exposure access mode is not supported';
        }

        return {
            host: exposure.targetHost,
            port: exposure.targetPort
        };
    }

    handleData(payload: BinaryTunnelDataPayload): void {
        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            this.options.coordinator.forgetSessionActivity(payload.sessionId);
            return;
        }

        if (!this.isWritable(tunnelState)) {
            this.completeClose(payload.sessionId);
            return;
        }

        let chunk: Buffer;
        try {
            chunk = decodeStreamChunk(payload.chunk);
        } catch (error) {
            this.closeWithError(
                payload.sessionId,
                `Malformed tunnel envelope: ${errorMessage(error)}`
            );
            return;
        }

        this.options.coordinator.touchSession(payload.sessionId);

        const ackSequence = payload.requiresAck ? payload.sequence : undefined;
        if (ackSequence === undefined) {
            this.writeChunk(payload.sessionId, tunnelState, chunk);
            return;
        }

        let acknowledged = false;
        const acknowledgeDrain = (): void => {
            if (acknowledged) {
                return;
            }

            acknowledged = true;
            this.emitTo(payload.sessionId, {
                type: 'tunnel-drain',
                sessionId: payload.sessionId,
                sequence: ackSequence
            });
        };
        const isReadyForMore = this.writeChunk(payload.sessionId, tunnelState, chunk, acknowledgeDrain);

        if (!this.tunnelStates.has(payload.sessionId)) {
            return;
        }

        if (isReadyForMore) {
            acknowledgeDrain();
            return;
        }

        tunnelState.socket.once('drain', () => {
            const activeTunnelState = this.tunnelStates.get(payload.sessionId);
            if (activeTunnelState !== tunnelState || activeTunnelState.isClosing) {
                return;
            }

            acknowledgeDrain();
        });
    }

    handleDrain(payload: BinaryTunnelDrainPayload): void {
        const tunnelState = this.tunnelStates.get(payload.sessionId);
        if (!tunnelState) {
            this.options.coordinator.forgetSessionActivity(payload.sessionId);
            return;
        }

        const pendingAck = tunnelState.pendingOutboundAcks.get(payload.sequence);
        if (!pendingAck) {
            return;
        }

        this.options.coordinator.touchSession(payload.sessionId);
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
            this.completeClose(payload.sessionId);
        }
    }

    releaseTransport(transport: TunnelMessageTransport): void {
        for (const [sessionId, sessionTransport] of this.transports.entries()) {
            if (sessionTransport === transport) {
                this.cleanupSession(sessionId);
            }
        }
    }

    cleanupSession(sessionId: string): void {
        const tunnelState = this.tunnelStates.get(sessionId);
        if (!tunnelState) {
            this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        if (tunnelState.isClosing) {
            return;
        }
        tunnelState.isClosing = true;

        if (!tunnelState.isOpen) {
            this.options.coordinator.endSessionTransition({
                sessionId,
                transitionId: tunnelState.transitionId
            });
        }

        tunnelState.socket.removeListener('connect', tunnelState.onConnect);
        tunnelState.socket.removeListener('data', tunnelState.onData);
        tunnelState.socket.removeListener('error', tunnelState.onError);
        tunnelState.socket.removeListener('close', tunnelState.onClose);
        tunnelState.socket.removeListener('timeout', tunnelState.onTimeout);
        tunnelState.socket.on('error', () => undefined);

        for (const pendingAck of tunnelState.pendingOutboundAcks.values()) {
            clearTimeout(pendingAck.timeout);
        }
        tunnelState.pendingOutboundAcks.clear();
        tunnelState.pendingOutboundBytes = 0;
        tunnelState.isOutboundPaused = false;

        if (!tunnelState.socket.destroyed) {
            tunnelState.socket.destroy();
        }

        this.tunnelStates.delete(sessionId);
        this.transports.delete(sessionId);
        this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
    }

    private isWritable(tunnelState: TunnelState): boolean {
        return !tunnelState.isClosing && tunnelState.socket.writable;
    }

    private writeChunk(
        sessionId: string,
        tunnelState: TunnelState,
        chunk: Buffer,
        onWriteSuccess?: () => void
    ): boolean {
        if (!this.isWritable(tunnelState)) {
            this.completeClose(sessionId);
            return false;
        }

        try {
            return tunnelState.socket.write(chunk, (error?: Error | null) => {
                if (error) {
                    this.closeWithError(sessionId, error.message);
                    return;
                }

                onWriteSuccess?.();
            });
        } catch (error) {
            this.closeWithError(sessionId, errorMessage(error));
            return false;
        }
    }

    private emitData(
        sessionId: string,
        tunnelState: TunnelState,
        chunk: Buffer,
        isBinary: boolean
    ): void {
        this.options.coordinator.touchSession(sessionId);
        const sequence = ++tunnelState.nextOutboundSequence;
        const bytes = chunk.byteLength;
        const timeout = setTimeout(() => {
            const activeTunnelState = this.tunnelStates.get(sessionId);
            const pendingAck = activeTunnelState?.pendingOutboundAcks.get(sequence);
            if (!activeTunnelState || !pendingAck) {
                return;
            }

            activeTunnelState.pendingOutboundAcks.delete(sequence);
            activeTunnelState.pendingOutboundBytes = Math.max(0, activeTunnelState.pendingOutboundBytes - pendingAck.bytes);
            this.closeWithError(
                sessionId,
                `Timed out waiting for tunnel drain acknowledgement after ${TUNNEL_DRAIN_TIMEOUT_MS}ms`
            );
        }, TUNNEL_DRAIN_TIMEOUT_MS);
        timeout.unref();

        tunnelState.pendingOutboundAcks.set(sequence, {
            bytes,
            timeout
        });
        tunnelState.pendingOutboundBytes += bytes;

        this.emitTo(sessionId, {
            type: 'tunnel-data',
            sessionId,
            chunk: encodeStreamChunk(chunk),
            isBinary,
            sequence,
            requiresAck: true
        });

        if (
            tunnelState.pendingOutboundBytes > TUNNEL_FLOW_CONTROL_WINDOW_BYTES
            && !tunnelState.isOutboundPaused
            && !tunnelState.socket.destroyed
        ) {
            tunnelState.isOutboundPaused = true;
            tunnelState.socket.pause();
        }
    }

    private emitTo(sessionId: string, message: ReverseChannelOutboundMessage): void {
        this.transports.get(sessionId)?.emitMessage(message);
    }

    private emitState(
        sessionId: string,
        status: TeamClusterDaemonTunnelStatePayload['status'],
        error?: string
    ): void {
        this.emitTo(sessionId, {
            type: 'tunnel-state',
            sessionId,
            status,
            ...(error !== undefined ? { error } : {})
        });
    }

    private closeWithError(sessionId: string, error: string, transition?: SessionTransition): void {
        if (transition) {
            this.options.coordinator.endSessionTransition(transition);
        }
        this.emitState(sessionId, REVERSE_CHANNEL.TunnelSessionStatus.Closed, error);
        this.cleanupSession(sessionId);
    }

    private completeClose(sessionId: string, transition?: SessionTransition): void {
        if (transition) {
            this.options.coordinator.endSessionTransition(transition);
        }

        const tunnelState = this.tunnelStates.get(sessionId);
        if (!tunnelState) {
            return;
        }

        if (tunnelState.pendingOutboundAcks.size > 0) {
            tunnelState.isClosePending = true;
            return;
        }

        this.emitTo(sessionId, {
            type: 'tunnel-close',
            sessionId
        });
        this.cleanupSession(sessionId);
    }
}
