import { errorMessage } from '@shared/application/utilities/error-message';
import { SESSION_ATTACH_TIMEOUT_MS, WEBSOCKET_BUFFERED_AMOUNT_BYTES_CAP, WEBSOCKET_PENDING_MESSAGE_BYTES_CAP } from '@core/constants/reverse-channel';
import { decodeStreamChunk, encodeStreamChunk } from '@shared/contracts/channel/binary-envelope';
import { createSessionAttachFailureResult, failSessionAttach } from '@modules/container/services/sessions/session-transitions';
import { WebSocket } from 'ws';
import type { CloseEvent, Data, MessageEvent } from 'ws';
import type { TeamClusterDaemonSessionAttachPayload } from '@voltstack/daemon-cluster-client';
import type { BinarySessionInputPayload, ReverseChannelOutboundMessage } from '@shared/contracts/channel/binary-messages';
import type { SessionCommandResult, SessionTransitionCoordinator } from '@modules/container/services/sessions/session-transitions';

type WebSocketSessionAttachPayload = TeamClusterDaemonSessionAttachPayload & {
    protocols?: string[];
};

type WebSocketSessionStatus = 'connecting' | 'open' | 'closed';
type PendingWebSocketMessage = Buffer | string;

interface WebSocketMessageResult {
    data: Buffer;
    isBinary: boolean;
};

interface ReverseChannelWebSocketState {
    status: WebSocketSessionStatus;
    pendingMessageBytes: number;
    transitionId: number;
    socket: WebSocket;
    openTimeout: ReturnType<typeof setTimeout> | null;
    pendingMessages: PendingWebSocketMessage[];
    onOpen: () => void;
    onMessage: (event: MessageEvent) => void;
    onError: () => void;
    onClose: (event: CloseEvent) => void;
};

interface WebSocketSessionManagerOptions {
    coordinator: SessionTransitionCoordinator;
};

export class WebSocketSessionManager {
    readonly webSocketStates = new Map<string, ReverseChannelWebSocketState>();

    constructor(private readonly options: WebSocketSessionManagerOptions) {}

    async attachSession(payload: WebSocketSessionAttachPayload): Promise<SessionCommandResult> {
        if (!payload.targetUrl) {
            return failSessionAttach(this.options.coordinator, payload.sessionId, 400, 'targetUrl is required');
        }

        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            return failSessionAttach(this.options.coordinator, payload.sessionId, 409, 'Session attach is already in progress');
        }

        try {
            const webSocket = payload.protocols && payload.protocols.length > 0
                ? new WebSocket(payload.targetUrl, payload.protocols)
                : new WebSocket(payload.targetUrl);

            return await new Promise<SessionCommandResult>((resolve) => {
                let openTimeout: ReturnType<typeof setTimeout> | null = null;
                let attachSettled = false;

                const resolveAttachFailure = (status: number, message: string): void => {
                    if (attachSettled) {
                        return;
                    }

                    attachSettled = true;
                    resolve(createSessionAttachFailureResult(status, message));
                };

                const clearOpenTimeout = (): void => {
                    if (!openTimeout) {
                        return;
                    }

                    clearTimeout(openTimeout);
                    openTimeout = null;
                };

                openTimeout = setTimeout(() => {
                    this.endSessionWithError(payload.sessionId, 'Reverse channel websocket attach timed out');
                    resolveAttachFailure(504, 'Reverse channel websocket attach timed out');
                }, SESSION_ATTACH_TIMEOUT_MS);

                openTimeout.unref();

                this.options.coordinator.cleanupInteractiveSession(payload.sessionId);

                const onOpen = () => {
                    const webSocketState = this.webSocketStates.get(payload.sessionId);
                    if (webSocketState) {
                        webSocketState.openTimeout = null;
                        if (webSocketState.status === 'connecting') {
                            webSocketState.status = 'open';
                        }
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

                            webSocketState.pendingMessageBytes = Math.max(0, webSocketState.pendingMessageBytes - messageBytes);
                            webSocket.send(nextMessage, { binary: typeof nextMessage !== 'string' });
                        }
                    }

                    if (attachSettled) {
                        return;
                    }

                    attachSettled = true;
                    resolve({
                        status: 200,
                        data: {
                            attached: true,
                            selectedProtocol: webSocket.protocol || undefined
                        }
                    });
                };

                const onMessage = (event: MessageEvent) => {
                    this.options.coordinator.touchSession(payload.sessionId);

                    try {
                        const message = this.readWebSocketMessage(event.data);
                        this.options.coordinator.emitMessage({
                            type: 'session-data',
                            sessionId: payload.sessionId,
                            chunk: encodeStreamChunk(message.data),
                            isBinary: message.isBinary
                        });
                    } catch (error) {
                        this.endSessionWithError(payload.sessionId, (error as Error).message);
                    }
                };

                /** Shared by `error` and `close`: both end the session and fail a still-pending attach. */
                const finalizeSessionClose = (
                    endMessage: ReverseChannelOutboundMessage,
                    attachFailureMessage: string
                ): void => {
                    const webSocketState = this.webSocketStates.get(payload.sessionId);
                    const isOpen = webSocketState?.status === 'open';
                    if (webSocketState) {
                        webSocketState.openTimeout = null;
                        webSocketState.status = 'closed';
                    }

                    clearOpenTimeout();
                    this.options.coordinator.endSessionTransition(sessionTransition);
                    this.options.coordinator.emitMessage(endMessage);
                    this.cleanupSession(payload.sessionId);

                    if (!isOpen) {
                        resolveAttachFailure(502, attachFailureMessage);
                    }
                };

                const onError = () => {
                    finalizeSessionClose(
                        {
                            type: 'session-end',
                            sessionId: payload.sessionId,
                            error: 'Reverse channel websocket failed'
                        },
                        'Reverse channel websocket failed'
                    );
                };

                const onClose = (event: CloseEvent) => {
                    finalizeSessionClose(
                        {
                            type: 'session-end',
                            sessionId: payload.sessionId,
                            code: event.code,
                            message: event.reason === '' ? undefined : event.reason
                        },
                        event.reason === ''
                            ? 'Reverse channel websocket closed before opening'
                            : event.reason
                    );
                };

                webSocket.binaryType = 'arraybuffer';
                webSocket.addEventListener('open', onOpen);
                webSocket.addEventListener('message', onMessage);
                webSocket.addEventListener('error', onError);
                webSocket.addEventListener('close', onClose);

                this.webSocketStates.set(payload.sessionId, {
                    status: 'connecting',
                    pendingMessageBytes: 0,
                    transitionId: sessionTransition.transitionId,
                    socket: webSocket,
                    openTimeout,
                    pendingMessages: [],
                    onOpen,
                    onMessage,
                    onError,
                    onClose
                });
                this.options.coordinator.touchSession(payload.sessionId);
            });
        } catch (error) {
            this.options.coordinator.endSessionTransition(sessionTransition);
            return failSessionAttach(this.options.coordinator, payload.sessionId, 500, (error as Error).message);
        }
    }

    handleInput(payload: BinarySessionInputPayload): boolean {
        const webSocketState = this.webSocketStates.get(payload.sessionId);
        if (!webSocketState) {
            return false;
        }

        let rawBuffer: Buffer;
        try {
            rawBuffer = decodeStreamChunk(payload.chunk);
        } catch (error) {
            this.endSessionWithError(payload.sessionId, `Malformed websocket input envelope: ${errorMessage(error)}`);
            return true;
        }

        this.options.coordinator.touchSession(payload.sessionId);

        const message = payload.isBinary ? rawBuffer : rawBuffer.toString('utf8');

        if (webSocketState.socket.readyState === WebSocket.CONNECTING) {
            this.enqueuePendingWebSocketMessage(payload.sessionId, message);
            return true;
        }

        if (webSocketState.socket.readyState !== WebSocket.OPEN) {
            this.endSessionWithError(payload.sessionId, 'Reverse channel websocket is no longer open');
            return true;
        }

        const messageBytes = this.getWebSocketMessageSize(message);
        if (!this.ensureWebSocketWithinBufferCap(payload.sessionId, webSocketState.socket, messageBytes)) {
            return true;
        }

        webSocketState.socket.send(message, { binary: payload.isBinary });
        return true;
    }

    cleanupSession(sessionId: string): void {
        const webSocketState = this.webSocketStates.get(sessionId);
        if (!webSocketState) {
            this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        if (webSocketState.status !== 'open') {
            this.options.coordinator.endSessionTransition({
                sessionId,
                transitionId: webSocketState.transitionId
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

        webSocketState.status = 'closed';
        this.webSocketStates.delete(sessionId);
        this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
    }

    /**
     * `binaryType` is pinned to `arraybuffer` at construction, so `ws` only ever hands back a
     * string (text frames) or an `ArrayBuffer` (binary frames); the view branch covers its
     * default `nodebuffer` shape.
     */
    private readWebSocketMessage(data: Data): WebSocketMessageResult {
        if (typeof data === 'string') {
            return {
                data: Buffer.from(data, 'utf8'),
                isBinary: false
            };
        }

        if (data instanceof ArrayBuffer) {
            return {
                data: Buffer.from(data),
                isBinary: true
            };
        }

        if (ArrayBuffer.isView(data)) {
            return {
                data: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
                isBinary: true
            };
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
        const nextPendingMessageBytes = webSocketState.pendingMessageBytes + messageBytes;

        if (nextPendingMessageBytes > WEBSOCKET_PENDING_MESSAGE_BYTES_CAP) {
            this.endSessionWithError(
                sessionId,
                `Reverse channel websocket pending queue cap exceeded while connecting (${nextPendingMessageBytes} bytes > ${WEBSOCKET_PENDING_MESSAGE_BYTES_CAP} bytes)`
            );
            return;
        }

        webSocketState.pendingMessages.push(message);
        webSocketState.pendingMessageBytes += messageBytes;
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
        this.options.coordinator.emitMessage({
            type: 'session-end',
            sessionId,
            error
        });
        this.cleanupSession(sessionId);
    }
}
