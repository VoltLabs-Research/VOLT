import { BASE64_SESSION_CHUNK_PATTERN, SESSION_ATTACH_TIMEOUT_MS, WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP, WEBSOCKET_PENDING_MESSAGE_BYTES_CAP } from '@/core/reverse-channel/contracts/reverse-channel-session-constants';
import { WebSocket } from 'ws';
import type { TeamClusterDaemonSessionAttachPayload, TeamClusterDaemonSessionDataPayload, TeamClusterDaemonSessionEndPayload, TeamClusterDaemonSessionInputPayload } from '@/contracts';
import type { CommandResult } from '@voltstack/daemon-cluster-client';
import { assign, createActor, createMachine, type ActorRefFrom } from 'xstate';

type WebSocketMessageData = string | ArrayBuffer | Blob | ArrayBufferView | Buffer[];
type PendingWebSocketMessage = Buffer | string;

interface WebSocketMessageResult {
    data: Buffer;
    isBinary: boolean;
};

interface ReverseChannelMessageEvent {
    data: WebSocketMessageData;
};

interface ReverseChannelCloseEvent {
    code: number;
    reason: string;
};

const webSocketSessionMachine = createMachine({
    types: {} as {
        context: {
            pendingMessageBytes: number;
            transitionId: number;
        };
        events:
            | { type: 'OPENED' }
            | { type: 'FAILED' }
            | { type: 'CLOSED' }
            | { type: 'ENQUEUE_PENDING'; size: number }
            | { type: 'DEQUEUE_PENDING'; size: number };
        input: {
            transitionId: number;
        };
    },
    id: 'reverse-channel-websocket-session',
    initial: 'connecting',
    context: ({ input }) => ({
        pendingMessageBytes: 0,
        transitionId: input.transitionId
    }),
    states: {
        connecting: {
            on: {
                OPENED: 'open',
                FAILED: 'closed',
                CLOSED: 'closed',
                ENQUEUE_PENDING: {
                    actions: assign({
                        pendingMessageBytes: ({ context, event }) => context.pendingMessageBytes + event.size
                    })
                },
                DEQUEUE_PENDING: {
                    actions: assign({
                        pendingMessageBytes: ({ context, event }) => Math.max(0, context.pendingMessageBytes - event.size)
                    })
                }
            }
        },
        open: {
            on: {
                FAILED: 'closed',
                CLOSED: 'closed',
                ENQUEUE_PENDING: {
                    actions: assign({
                        pendingMessageBytes: ({ context, event }) => context.pendingMessageBytes + event.size
                    })
                },
                DEQUEUE_PENDING: {
                    actions: assign({
                        pendingMessageBytes: ({ context, event }) => Math.max(0, context.pendingMessageBytes - event.size)
                    })
                }
            }
        },
        closed: {
            type: 'final'
        }
    }
});

type WebSocketSessionActor = ActorRefFrom<typeof webSocketSessionMachine>;

interface ReverseChannelWebSocketState {
    actor: WebSocketSessionActor;
    socket: WebSocket;
    openTimeout: ReturnType<typeof setTimeout> | null;
    pendingMessages: PendingWebSocketMessage[];
    onOpen: () => void;
    onMessage: (event: ReverseChannelMessageEvent) => void;
    onError: () => void;
    onClose: (event: ReverseChannelCloseEvent) => void;
};

interface SessionTransition {
    sessionId: string;
    transitionId: number;
};

interface WebSocketSessionManagerOptions {
    coordinator: WebSocketSessionManagerCoordinator;
};

interface WebSocketSessionManagerCoordinator {
    beginSessionTransition(sessionId: string): SessionTransition | null;
    cleanupInteractiveSession(sessionId: string): void;
    clearSessionActivityIfUntracked(sessionId: string): void;
    emitSessionData(payload: TeamClusterDaemonSessionDataPayload): void;
    emitSessionEnd(payload: TeamClusterDaemonSessionEndPayload): void;
    endSessionTransition(transition: SessionTransition): void;
    touchSession(sessionId: string): void;
};

export class WebSocketSessionManager {
    readonly webSocketStates = new Map<string, ReverseChannelWebSocketState>();

    constructor(private readonly options: WebSocketSessionManagerOptions) {}

    hasSession(sessionId: string): boolean {
        return this.webSocketStates.has(sessionId);
    }

    getSessionIds(): string[] {
        return Array.from(this.webSocketStates.keys());
    }

    async attachSession(payload: TeamClusterDaemonSessionAttachPayload): Promise<CommandResult> {
        if (!payload.targetUrl) {
            const message = 'targetUrl is required';
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(400, message);
        }

        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            const message = 'Session attach is already in progress';
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(409, message);
        }

        try {
            const webSocket = payload.protocols && payload.protocols.length > 0
                ? new WebSocket(payload.targetUrl, payload.protocols)
                : new WebSocket(payload.targetUrl);
            const pendingMessages: PendingWebSocketMessage[] = [];
            const sessionActor = createActor(webSocketSessionMachine, {
                input: {
                    transitionId: sessionTransition.transitionId
                }
            });
            sessionActor.start();

            return await new Promise<CommandResult>((resolve) => {
                let openTimeout: ReturnType<typeof setTimeout> | null = null;
                let attachSettled = false;

                const resolveAttachFailure = (status: number, message: string): void => {
                    if (attachSettled) {
                        return;
                    }

                    attachSettled = true;
                    resolve(this.createSessionAttachFailureResult(status, message));
                };

                const clearOpenTimeout = (): void => {
                    if (!openTimeout) {
                        return;
                    }

                    clearTimeout(openTimeout);
                    openTimeout = null;
                };

                openTimeout = setTimeout(() => {
                    this.options.coordinator.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: 'Reverse channel websocket attach timed out'
                    });
                    this.cleanupSession(payload.sessionId);
                    resolveAttachFailure(504, 'Reverse channel websocket attach timed out');
                }, SESSION_ATTACH_TIMEOUT_MS);

                openTimeout.unref();

                this.options.coordinator.cleanupInteractiveSession(payload.sessionId);

                const onOpen = () => {
                    const webSocketState = this.webSocketStates.get(payload.sessionId);
                    if (webSocketState) {
                        webSocketState.openTimeout = null;
                        webSocketState.actor.send({ type: 'OPENED' });
                    }

                    clearOpenTimeout();
                    this.options.coordinator.endSessionTransition(sessionTransition);
                    this.options.coordinator.touchSession(payload.sessionId);

                    if (webSocketState) {
                        while (webSocketState.pendingMessages.length > 0 && webSocket.readyState === WebSocket.OPEN) {
                            const nextMessage = webSocketState.pendingMessages.shift();

                            if (nextMessage === undefined) {
                                return;
                            }

                            const messageBytes = this.getWebSocketMessageSize(nextMessage);
                            if (!this.ensureWebSocketWithinBufferCap(payload.sessionId, webSocket, messageBytes)) {
                                return;
                            }

                            webSocketState.actor.send({
                                type: 'DEQUEUE_PENDING',
                                size: messageBytes
                            });
                            webSocket.send(nextMessage);
                        }
                    }

                    if (attachSettled) {
                        return;
                    }

                    attachSettled = true;
                    resolve({
                        status: 200,
                        data: {
                            status: 'success',
                            data: { attached: true }
                        }
                    });
                };

                const onMessage = (event: ReverseChannelMessageEvent) => {
                    this.options.coordinator.touchSession(payload.sessionId);
                    this.readWebSocketMessage(event.data).then((message) => {
                        this.options.coordinator.emitSessionData({
                            type: 'session-data',
                            sessionId: payload.sessionId,
                            chunkBase64: message.data.toString('base64'),
                            isBinary: message.isBinary
                        });
                    }).catch((error: Error) => {
                        this.options.coordinator.emitSessionEnd({
                            type: 'session-end',
                            sessionId: payload.sessionId,
                            error: error.message
                        });
                        this.cleanupSession(payload.sessionId);
                    });
                };

                const onError = () => {
                    const webSocketState = this.webSocketStates.get(payload.sessionId);
                    const isOpen = webSocketState ? this.isSessionOpen(webSocketState) : false;
                    if (webSocketState) {
                        webSocketState.openTimeout = null;
                        webSocketState.actor.send({ type: 'FAILED' });
                    }

                    clearOpenTimeout();
                    this.options.coordinator.endSessionTransition(sessionTransition);
                    this.options.coordinator.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: 'Reverse channel websocket failed'
                    });
                    this.cleanupSession(payload.sessionId);

                    if (!isOpen) {
                        resolveAttachFailure(502, 'Reverse channel websocket failed');
                    }
                };

                const onClose = (event: ReverseChannelCloseEvent) => {
                    const webSocketState = this.webSocketStates.get(payload.sessionId);
                    const isOpen = webSocketState ? this.isSessionOpen(webSocketState) : false;
                    if (webSocketState) {
                        webSocketState.openTimeout = null;
                        webSocketState.actor.send({ type: 'CLOSED' });
                    }

                    clearOpenTimeout();
                    this.options.coordinator.endSessionTransition(sessionTransition);
                    this.options.coordinator.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        code: event.code,
                        message: event.reason === '' ? undefined : event.reason
                    });
                    this.cleanupSession(payload.sessionId);

                    if (!isOpen) {
                        resolveAttachFailure(
                            502,
                            event.reason === ''
                                ? 'Reverse channel websocket closed before opening'
                                : event.reason
                        );
                    }
                };

                webSocket.binaryType = 'arraybuffer';
                webSocket.addEventListener('open', onOpen);
                webSocket.addEventListener('message', onMessage);
                webSocket.addEventListener('error', onError);
                webSocket.addEventListener('close', onClose);

                this.webSocketStates.set(payload.sessionId, {
                    actor: sessionActor,
                    socket: webSocket,
                    openTimeout,
                    pendingMessages,
                    onOpen,
                    onMessage,
                    onError,
                    onClose
                });
                this.options.coordinator.touchSession(payload.sessionId);
            });
        } catch (error) {
            this.options.coordinator.endSessionTransition(sessionTransition);
            const message = (error as Error).message;
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(500, message);
        }
    }

    handleInput(payload: TeamClusterDaemonSessionInputPayload): boolean {
        const webSocketState = this.webSocketStates.get(payload.sessionId);
        if (!webSocketState) {
            return false;
        }

        if (!BASE64_SESSION_CHUNK_PATTERN.test(payload.chunkBase64)) {
            this.endSessionWithError(payload.sessionId, 'Session input is not valid base64 data');
            return true;
        }

        this.options.coordinator.touchSession(payload.sessionId);

        const message = payload.isBinary
            ? Buffer.from(payload.chunkBase64, 'base64')
            : Buffer.from(payload.chunkBase64, 'base64').toString('utf8');

        if (webSocketState.socket.readyState === WebSocket.CONNECTING) {
            this.enqueuePendingWebSocketMessage(payload.sessionId, message);
            return true;
        }

        if (webSocketState.socket.readyState !== WebSocket.OPEN) {
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'Reverse channel websocket is no longer open'
            });
            this.cleanupSession(payload.sessionId);
            return true;
        }

        const messageBytes = this.getWebSocketMessageSize(message);
        const canSendMessage = this.ensureWebSocketWithinBufferCap(
            payload.sessionId,
            webSocketState.socket,
            messageBytes
        );

        if (!canSendMessage) {
            return true;
        }

        webSocketState.socket.send(message);
        return true;
    }

    cleanupSession(sessionId: string): void {
        const webSocketState = this.webSocketStates.get(sessionId);
        if (!webSocketState) {
            this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        if (!this.isSessionOpen(webSocketState)) {
            this.options.coordinator.endSessionTransition({
                sessionId,
                transitionId: webSocketState.actor.getSnapshot().context.transitionId
            });
        }

        webSocketState.pendingMessages.length = 0;
        if (webSocketState.openTimeout) {
            clearTimeout(webSocketState.openTimeout);
        }
        webSocketState.socket.removeEventListener('open', webSocketState.onOpen);
        webSocketState.socket.removeEventListener('message', webSocketState.onMessage);
        webSocketState.socket.removeEventListener('error', webSocketState.onError);
        webSocketState.socket.removeEventListener('close', webSocketState.onClose);

        if (
            webSocketState.socket.readyState === WebSocket.OPEN
            || webSocketState.socket.readyState === WebSocket.CONNECTING
        ) {
            webSocketState.socket.close();
        }

        webSocketState.actor.send({ type: 'CLOSED' });
        webSocketState.actor.stop();
        this.webSocketStates.delete(sessionId);
        this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
    }

    private createSessionAttachFailureResult(status: number, message: string): CommandResult {
        return {
            status,
            data: {
                status: 'error',
                message
            }
        };
    }

    private async readWebSocketMessage(data: WebSocketMessageData): Promise<WebSocketMessageResult> {
        if (typeof data === 'string') {
            return { data: Buffer.from(data, 'utf8'), isBinary: false };
        }

        if (Array.isArray(data)) {
            return { data: Buffer.concat(data), isBinary: true };
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

    private getWebSocketMessageSize(message: PendingWebSocketMessage): number {
        if (typeof message === 'string') {
            return Buffer.byteLength(message, 'utf8');
        }

        return message.byteLength;
    }

    private enqueuePendingWebSocketMessage(sessionId: string, message: PendingWebSocketMessage): void {
        const webSocketState = this.webSocketStates.get(sessionId);
        if (!webSocketState) {
            return;
        }

        const messageBytes = this.getWebSocketMessageSize(message);
        const nextPendingMessageBytes = webSocketState.actor.getSnapshot().context.pendingMessageBytes + messageBytes;

        if (nextPendingMessageBytes > WEBSOCKET_PENDING_MESSAGE_BYTES_CAP) {
            this.endSessionWithError(
                sessionId,
                `Reverse channel websocket pending queue cap exceeded while connecting (${nextPendingMessageBytes} bytes > ${WEBSOCKET_PENDING_MESSAGE_BYTES_CAP} bytes)`
            );
            return;
        }

        webSocketState.pendingMessages.push(message);
        webSocketState.actor.send({
            type: 'ENQUEUE_PENDING',
            size: messageBytes
        });
    }

    private ensureWebSocketWithinBufferCap(sessionId: string, socket: WebSocket, messageBytes: number): boolean {
        if (socket.bufferedAmount > WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP) {
            this.endSessionWithError(
                sessionId,
                `Reverse channel websocket bufferedAmount cap exceeded before write (${socket.bufferedAmount} bytes > ${WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP} bytes)`
            );
            return false;
        }

        const projectedBufferedAmount = socket.bufferedAmount + messageBytes;
        if (projectedBufferedAmount > WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP) {
            this.endSessionWithError(
                sessionId,
                `Reverse channel websocket bufferedAmount cap would be exceeded by write (${projectedBufferedAmount} bytes > ${WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP} bytes)`
            );
            return false;
        }

        return true;
    }

    private endSessionWithError(sessionId: string, error: string): void {
        this.options.coordinator.emitSessionEnd({
            type: 'session-end',
            sessionId,
            error
        });
        this.cleanupSession(sessionId);
    }

    private isSessionOpen(webSocketState: ReverseChannelWebSocketState): boolean {
        return webSocketState.actor.getSnapshot().matches('open');
    }
}
