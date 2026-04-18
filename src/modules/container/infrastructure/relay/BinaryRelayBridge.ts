import { logger } from '@/core/logger';
import { SESSION_ATTACH_TIMEOUT_MS } from '@/core/reverse-channel/contracts/reverse-channel-session-constants';
import WebSocket, { createWebSocketStream } from 'ws';
import type { Duplex } from 'node:stream';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { ObjectGatewayTelemetry } from '@/core/observability/infrastructure/ObjectGatewayTelemetry';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import type { TeamClusterDaemonBinaryRelayDescriptor, TeamClusterDaemonTunnelClosePayload, TeamClusterDaemonTunnelStatePayload } from '@/core/reverse-channel/contracts/reverse-channel-socket';
import net from 'node:net';
import { createActor, createMachine, type ActorRefFrom } from 'xstate';

interface SessionTransition {
    sessionId: string;
    transitionId: number;
}

interface BinaryRelaySocketBridgeCoordinator {
    emitTunnelClose: (payload: TeamClusterDaemonTunnelClosePayload) => void;
    emitTunnelState: (payload: TeamClusterDaemonTunnelStatePayload) => void;
    touchSession: (sessionId: string) => void;
    clearSessionActivityIfUntracked: (sessionId: string) => void;
    endSessionTransition: (transition: SessionTransition) => void;
    wasSessionTransitionCancelled: (transition: SessionTransition) => boolean;
}

interface OpenBinaryRelayTunnelInput {
    sessionId: string;
    transition: SessionTransition;
    relay: TeamClusterDaemonBinaryRelayDescriptor;
    targetHost: string;
    targetPort: number;
    isObjectGatewayTunnel: boolean;
}

interface CleanupSessionOptions {
    emitTunnelClose: boolean;
}

const binaryRelayTunnelMachine = createMachine({
    types: {} as {
        context: {
            transitionId: number;
        };
        events:
            | { type: 'OPENED' }
            | { type: 'FAILED' }
            | { type: 'CLOSED' };
        input: {
            transitionId: number;
        };
    },
    id: 'binary-relay-tunnel',
    initial: 'opening',
    context: ({ input }) => ({
        transitionId: input.transitionId
    }),
    states: {
        opening: {
            on: {
                OPENED: 'open',
                FAILED: 'closed',
                CLOSED: 'closed'
            }
        },
        open: {
            on: {
                FAILED: 'closed',
                CLOSED: 'closed'
            }
        },
        closed: {
            type: 'final'
        }
    }
});

type BinaryRelayTunnelActor = ActorRefFrom<typeof binaryRelayTunnelMachine>;

interface BinaryRelayTunnelState {
    sessionId: string;
    transition: SessionTransition;
    actor: BinaryRelayTunnelActor;
    targetSocket: net.Socket;
    relaySocket: WebSocket | null;
    relayStream: Duplex | null;
    isObjectGatewayTunnel: boolean;
    tunnelOpenStartedAt: number;
    onTargetConnect: () => void;
    onTargetData: (chunk: Buffer) => void;
    onTargetError: (error: Error) => void;
    onTargetClose: () => void;
    onTargetTimeout: () => void;
    onRelayOpen: () => void;
    onRelayData: (chunk: Buffer) => void;
    onRelayError: (error: Error) => void;
    onRelayClose: (code: number, reason: Buffer) => void;
    onRelayUnexpectedResponse: (_request: ClientRequest, response: IncomingMessage) => void;
}

export class BinaryRelayBridge {
    readonly sessions = new Map<string, BinaryRelayTunnelState>();

    constructor(
        private readonly coordinator: BinaryRelaySocketBridgeCoordinator,
        private readonly objectGatewayTelemetry?: ObjectGatewayTelemetry
    ) {}

    openTunnel(input: OpenBinaryRelayTunnelInput): void {
        this.cleanupSession(input.sessionId, {
            emitTunnelClose: false
        });

        const tunnelActor = createActor(binaryRelayTunnelMachine, {
            input: {
                transitionId: input.transition.transitionId
            }
        });
        tunnelActor.start();

        const targetSocket = net.createConnection({
            host: input.targetHost,
            port: input.targetPort
        });
        targetSocket.setNoDelay(true);

        const failOpening = (error: Error): void => {
            const state = this.sessions.get(input.sessionId);
            state?.actor.send({ type: 'FAILED' });
            this.coordinator.endSessionTransition(input.transition);
            this.coordinator.emitTunnelState({
                type: 'tunnel-state',
                sessionId: input.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Closed,
                error: error.message
            });
            this.cleanupSession(input.sessionId, {
                emitTunnelClose: false
            });
        };

        const onTargetConnect = (): void => {
            if (this.coordinator.wasSessionTransitionCancelled(input.transition)) {
                this.cleanupSession(input.sessionId, {
                    emitTunnelClose: false
                });
                return;
            }

            let relaySocket: WebSocket;
            try {
                if (input.relay.relayProtocolVersion !== 1) {
                    throw new Error(`Unsupported binary relay protocol version: ${input.relay.relayProtocolVersion}`);
                }

                logger.info(`Connecting daemon binary relay session relaySessionId=${input.relay.relaySessionId}, relayUrl=${input.relay.relayUrl}`);

                relaySocket = new WebSocket(input.relay.relayUrl, {
                    perMessageDeflate: false,
                    headers: {
                        'x-team-cluster-relay-session-id': input.relay.relaySessionId,
                        'x-team-cluster-relay-token': input.relay.relayToken,
                        'x-team-cluster-relay-protocol-version': `${input.relay.relayProtocolVersion}`
                    }
                });
            } catch (error) {
                failOpening(error instanceof Error ? error : new Error('Failed to create binary relay websocket'));
                return;
            }

            const state = this.sessions.get(input.sessionId);
            if (!state) {
                relaySocket.close();
                return;
            }

            state.relaySocket = relaySocket;
            relaySocket.once('open', state.onRelayOpen);
            relaySocket.on('error', state.onRelayError);
            relaySocket.on('close', state.onRelayClose);
            relaySocket.once('unexpected-response', state.onRelayUnexpectedResponse);
        };

        const onTargetData = (_chunk: Buffer): void => {
            this.coordinator.touchSession(input.sessionId);
        };

        const onTargetError = (error: Error): void => {
            const state = this.sessions.get(input.sessionId);
            if (!state) {
                return;
            }

            if (!this.isTunnelOpen(state)) {
                failOpening(error);
                return;
            }

            logger.warn(`Binary relay target socket failed for sessionId=${input.sessionId}: ${error.message}`);
            this.cleanupSession(input.sessionId, {
                emitTunnelClose: true
            });
        };

        const onTargetClose = (): void => {
            const state = this.sessions.get(input.sessionId);
            if (!state) {
                return;
            }

            if (!this.isTunnelOpen(state)) {
                failOpening(new Error('Binary relay target socket closed before relay attachment completed'));
                return;
            }

            this.cleanupSession(input.sessionId, {
                emitTunnelClose: true
            });
        };

        const onTargetTimeout = (): void => {
            failOpening(new Error('Tunnel session timed out while opening'));
        };

        const onRelayOpen = (): void => {
            const state = this.sessions.get(input.sessionId);
            if (!state || !state.relaySocket) {
                return;
            }

            if (this.coordinator.wasSessionTransitionCancelled(input.transition)) {
                this.cleanupSession(input.sessionId, {
                    emitTunnelClose: false
                });
                return;
            }

            const relayStream = createWebSocketStream(state.relaySocket) as Duplex;
            state.relayStream = relayStream;
            relayStream.on('data', state.onRelayData);
            relayStream.on('error', state.onRelayError);
            relayStream.on('close', () => {
                state.onRelayClose(1000, Buffer.alloc(0));
            });

            state.targetSocket.setTimeout(0);
            state.targetSocket.pipe(relayStream);
            relayStream.pipe(state.targetSocket);
            state.actor.send({ type: 'OPENED' });

            this.coordinator.endSessionTransition(input.transition);
            if (state.isObjectGatewayTunnel) {
                this.objectGatewayTelemetry?.recordObjectTunnelOpened(Date.now() - state.tunnelOpenStartedAt);
            }

            this.coordinator.emitTunnelState({
                type: 'tunnel-state',
                sessionId: input.sessionId,
                status: REVERSE_CHANNEL.TunnelSessionStatus.Open
            });
        };

        const onRelayData = (_chunk: Buffer): void => {
            this.coordinator.touchSession(input.sessionId);
        };

        const onRelayError = (error: Error): void => {
            const state = this.sessions.get(input.sessionId);
            if (!state) {
                return;
            }

            if (!this.isTunnelOpen(state)) {
                failOpening(error);
                return;
            }

            logger.warn(`Binary relay websocket failed for sessionId=${input.sessionId}: ${error.message}`);
            this.cleanupSession(input.sessionId, {
                emitTunnelClose: true
            });
        };

        const onRelayClose = (_code: number, _reason: Buffer): void => {
            const state = this.sessions.get(input.sessionId);
            if (!state) {
                return;
            }

            if (!this.isTunnelOpen(state)) {
                failOpening(new Error('Binary relay websocket closed before attachment completed'));
                return;
            }

            this.cleanupSession(input.sessionId, {
                emitTunnelClose: true
            });
        };

        const onRelayUnexpectedResponse = (_request: ClientRequest, response: IncomingMessage): void => {
            response.resume();
            failOpening(new Error(
                response.statusMessage
                    || `Binary relay websocket upgrade failed with status ${response.statusCode || 502}`
            ));
        };

        const state: BinaryRelayTunnelState = {
            sessionId: input.sessionId,
            transition: input.transition,
            actor: tunnelActor,
            targetSocket,
            relaySocket: null,
            relayStream: null,
            isObjectGatewayTunnel: input.isObjectGatewayTunnel,
            tunnelOpenStartedAt: Date.now(),
            onTargetConnect,
            onTargetData,
            onTargetError,
            onTargetClose,
            onTargetTimeout,
            onRelayOpen,
            onRelayData,
            onRelayError,
            onRelayClose,
            onRelayUnexpectedResponse
        };

        this.sessions.set(input.sessionId, state);
        this.coordinator.touchSession(input.sessionId);

        targetSocket.once('connect', onTargetConnect);
        targetSocket.on('data', onTargetData);
        targetSocket.on('error', onTargetError);
        targetSocket.on('close', onTargetClose);
        targetSocket.setTimeout(SESSION_ATTACH_TIMEOUT_MS, onTargetTimeout);
    }

    cleanupSession(sessionId: string, options: CleanupSessionOptions): void {
        const state = this.sessions.get(sessionId);
        if (!state) {
            this.coordinator.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        if (!this.isTunnelOpen(state)) {
            this.coordinator.endSessionTransition(state.transition);
        }

        state.targetSocket.removeListener('connect', state.onTargetConnect);
        state.targetSocket.removeListener('data', state.onTargetData);
        state.targetSocket.removeListener('error', state.onTargetError);
        state.targetSocket.removeListener('close', state.onTargetClose);
        state.targetSocket.removeListener('timeout', state.onTargetTimeout);

        if (state.relayStream) {
            state.relayStream.removeListener('data', state.onRelayData);
            state.relayStream.removeListener('error', state.onRelayError);
        }

        if (state.relaySocket) {
            state.relaySocket.removeListener('open', state.onRelayOpen);
            state.relaySocket.removeListener('error', state.onRelayError);
            state.relaySocket.removeListener('close', state.onRelayClose);
            state.relaySocket.removeListener('unexpected-response', state.onRelayUnexpectedResponse);
        }

        if (!state.targetSocket.destroyed) {
            state.targetSocket.destroy();
        }

        if (state.relaySocket && state.relaySocket.readyState < WebSocket.CLOSING) {
            state.relaySocket.close();
        }

        if (state.isObjectGatewayTunnel && this.isTunnelOpen(state)) {
            this.objectGatewayTelemetry?.recordObjectTunnelClosed();
        }

        state.actor.send({ type: 'CLOSED' });
        state.actor.stop();
        this.sessions.delete(sessionId);
        this.coordinator.clearSessionActivityIfUntracked(sessionId);

        if (options.emitTunnelClose) {
            this.coordinator.emitTunnelClose({
                type: 'tunnel-close',
                sessionId
            });
        }
    }

    private isTunnelOpen(state: BinaryRelayTunnelState): boolean {
        return state.actor.getSnapshot().matches('open');
    }
}
