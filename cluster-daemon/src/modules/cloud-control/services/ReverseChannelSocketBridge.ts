import { EventType } from '../../../shared/contracts';
import { DockerRuntimeService, type RuntimeTerminalAttachment } from '../../platform/services';
import {
    REVERSE_CHANNEL,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonResponseType,
    type TeamClusterDaemonSessionAttachPayload,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionDetachPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSessionInputPayload,
    type TeamClusterDaemonSessionResizePayload,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload
} from '../../../shared/contracts';
import type { DaemonConfig } from '../../../core/config';

interface ReverseChannelSocketEmitter {
    emit(event: string, payload: unknown): void;
    on(event: string, listener: (payload: TeamClusterDaemonMessage) => void): void;
};

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

export class ReverseChannelSocketBridge {
    private readonly terminalStates = new Map<string, ReverseChannelTerminalState>();
    private readonly webSocketStates = new Map<string, ReverseChannelWebSocketState>();
    private readonly handlers = new Map<string, ReverseChannelCommandHandler>();

    constructor(
        private readonly _config: DaemonConfig,
        private readonly dockerRuntimeService?: DockerRuntimeService
    ) {}

    registerHandler(handler: ReverseChannelCommandHandler): void {
        this.handlers.set(handler.command, handler);
    }

    bindToSocket(socket: ReverseChannelSocketEmitter): void {
        socket.on(EventType.TeamClusterDaemonMessage, async (message) => {
            if (message.type === 'command') {
                await this.handleCommand(socket, message.requestId, message.command, message.responseType, message.payload);
                return;
            }

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
            }
        });
    }

    cleanup(): void {
        for (const sessionId of Array.from(this.terminalStates.keys())) {
            this.cleanupTerminalSession(sessionId);
        }

        for (const sessionId of Array.from(this.webSocketStates.keys())) {
            this.cleanupWebSocketSession(sessionId);
        }
    }

    private async handleCommand(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        command: string,
        responseType: TeamClusterDaemonResponseType | undefined,
        payload: Record<string, unknown> | undefined
    ): Promise<void> {
        if (command === 'session.attach') {
            await this.handleSessionAttach(socket, requestId, payload);
            return;
        }

        const handler = this.handlers.get(command);
        if (!handler) {
            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: false,
                status: 404,
                message: `Unknown daemon command: ${command}`
            });
            return;
        }

        try {
            const result = await handler.execute(payload);

            if (responseType === REVERSE_CHANNEL.ResponseType.Stream && result.stream) {
                await this.emitStreamResponse(socket, requestId, result.stream, result.status || 200, result.headers);
                return;
            }

            if (responseType === REVERSE_CHANNEL.ResponseType.Buffer && result.body) {
                this.emitResponse(socket, {
                    type: 'response',
                    requestId,
                    ok: true,
                    status: result.status || 200,
                    headers: result.headers,
                    bodyBase64: result.body.toString('base64')
                });
                return;
            }

            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: true,
                status: result.status || 200,
                headers: result.headers,
                data: {
                    status: 'success',
                    data: result.data
                }
            });
        } catch (error: unknown) {
            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: false,
                status: 500,
                message: error instanceof Error ? error.message : 'Daemon command failed'
            });
        }
    }

    private async handleSessionAttach(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        payload: Record<string, unknown> | undefined
    ): Promise<void> {
        const attachPayload = payload as TeamClusterDaemonSessionAttachPayload | undefined;
        if (!attachPayload?.sessionId || !attachPayload.kind) {
            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: false,
                status: 400,
                message: 'Invalid session attach payload'
            });
            return;
        }

        if (attachPayload.kind === REVERSE_CHANNEL.SessionKind.Terminal) {
            await this.attachTerminal(socket, requestId, attachPayload);
            return;
        }

        if (attachPayload.kind === REVERSE_CHANNEL.SessionKind.WebSocket) {
            this.attachWebSocket(socket, requestId, attachPayload);
            return;
        }

        this.emitResponse(socket, {
            type: 'response',
            requestId,
            ok: false,
            status: 400,
            message: 'Unsupported session kind'
        });
    }

    private async attachTerminal(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        payload: TeamClusterDaemonSessionAttachPayload
    ): Promise<void> {
        if (!this.dockerRuntimeService || !payload.containerId) {
            this.emitSessionEnd(socket, {
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'Docker runtime not available'
            });
            return;
        }

        try {
            const attachment = await this.dockerRuntimeService.attachTerminal(payload.containerId);
            const onData = (chunk: Buffer) => {
                const message: TeamClusterDaemonSessionDataPayload = {
                    type: 'session-data',
                    sessionId: payload.sessionId,
                    chunkBase64: chunk.toString('base64'),
                    isBinary: true
                };
                socket.emit(EventType.TeamClusterDaemonMessage, message);
            };
            const onEnd = () => {
                this.emitSessionEnd(socket, {
                    type: 'session-end',
                    sessionId: payload.sessionId
                });
                this.cleanupTerminalSession(payload.sessionId);
            };
            const onError = (error: Error) => {
                this.emitSessionEnd(socket, {
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

            this.emitSessionEnd(socket, {
                type: 'session-end',
                sessionId: payload.sessionId
            });
            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: true,
                status: 200,
                data: {
                    status: 'success',
                    data: {
                        attached: true
                    }
                }
            });
        } catch (error: unknown) {
            this.emitSessionEnd(socket, {
                type: 'session-end',
                sessionId: payload.sessionId,
                error: error instanceof Error ? error.message : 'Failed to attach terminal'
            });
        }
    }

    private attachWebSocket(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        payload: TeamClusterDaemonSessionAttachPayload
    ): void {
        if (!payload.targetUrl) {
            this.emitSessionEnd(socket, {
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'targetUrl is required'
            });
            return;
        }

        try {
            const webSocket = new WebSocket(payload.targetUrl);
            const onMessage = (event: MessageEvent) => {
                this.handleWebSocketMessage(socket, payload.sessionId, event).catch((error: unknown) => {
                    this.emitSessionEnd(socket, {
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: error instanceof Error ? error.message : 'Failed to proxy websocket message'
                    });
                });
            };
            const onError = () => {
                this.emitSessionEnd(socket, {
                    type: 'session-end',
                    sessionId: payload.sessionId,
                    error: 'Reverse channel websocket failed'
                });
            };
            const onClose = (event: CloseEvent) => {
                this.emitSessionEnd(socket, {
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

            this.emitResponse(socket, {
                type: 'response',
                requestId,
                ok: true,
                status: 200,
                data: {
                    status: 'success',
                    data: {
                        attached: true
                    }
                }
            });
        } catch (error: unknown) {
            this.emitSessionEnd(socket, {
                type: 'session-end',
                sessionId: payload.sessionId,
                error: error instanceof Error ? error.message : 'Failed to attach websocket'
            });
        }
    }

    private handleSessionInput(payload: TeamClusterDaemonSessionInputPayload): void {
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

        terminalState.attachment.exec.resize({
            h: payload.rows,
            w: payload.cols
        }).catch(() => {});
    }

    private handleSessionDetach(payload: TeamClusterDaemonSessionDetachPayload): void {
        this.cleanupTerminalSession(payload.sessionId);
        this.cleanupWebSocketSession(payload.sessionId);
    }

    private async emitStreamResponse(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        stream: ReadableStream<Uint8Array>,
        status: number,
        headers?: TeamClusterDaemonSocketHeaders
    ): Promise<void> {
        const streamId = requestId;
        this.emitResponse(socket, {
            type: 'response',
            requestId,
            ok: true,
            status,
            headers,
            streamId
        });

        const reader = stream.getReader();
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }

                const streamPayload: TeamClusterDaemonSocketStreamPayload = {
                    type: 'stream',
                    requestId,
                    streamId,
                    chunkBase64: Buffer.from(chunk.value).toString('base64')
                };
                socket.emit(EventType.TeamClusterDaemonMessage, streamPayload);
            }

            const endPayload: TeamClusterDaemonSocketStreamStatePayload = {
                type: 'stream-end',
                requestId,
                streamId
            };
            socket.emit(EventType.TeamClusterDaemonMessage, endPayload);
        } catch (error: unknown) {
            const endPayload: TeamClusterDaemonSocketStreamStatePayload = {
                type: 'stream-end',
                requestId,
                streamId,
                message: error instanceof Error ? error.message : 'Failed to stream response'
            };
            socket.emit(EventType.TeamClusterDaemonMessage, endPayload);
        } finally {
            reader.releaseLock();
        }
    }

    private emitResponse(socket: ReverseChannelSocketEmitter, payload: TeamClusterDaemonSocketResponsePayload): void {
        socket.emit(EventType.TeamClusterDaemonMessage, payload);
    }

    private emitSessionEnd(socket: ReverseChannelSocketEmitter, payload: TeamClusterDaemonSessionEndPayload): void {
        socket.emit(EventType.TeamClusterDaemonMessage, payload);
    }

    private async handleWebSocketMessage(
        socket: ReverseChannelSocketEmitter,
        sessionId: string,
        event: MessageEvent
    ): Promise<void> {
        const message = await this.readWebSocketMessage(event.data);
        const payload: TeamClusterDaemonSessionDataPayload = {
            type: 'session-data',
            sessionId,
            chunkBase64: message.data.toString('base64'),
            isBinary: message.isBinary
        };
        socket.emit(EventType.TeamClusterDaemonMessage, payload);
    }

    private async readWebSocketMessage(data: unknown): Promise<WebSocketMessageResult> {
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

        if (data instanceof Blob) {
            return {
                data: Buffer.from(await data.arrayBuffer()),
                isBinary: true
            };
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
    }

    private cleanupWebSocketSession(sessionId: string): void {
        const webSocketState = this.webSocketStates.get(sessionId);
        if (!webSocketState) {
            return;
        }

        webSocketState.socket.removeEventListener('message', webSocketState.onMessage);
        webSocketState.socket.removeEventListener('error', webSocketState.onError);
        webSocketState.socket.removeEventListener('close', webSocketState.onClose);

        if (webSocketState.socket.readyState === WebSocket.OPEN || webSocketState.socket.readyState === WebSocket.CONNECTING) {
            webSocketState.socket.close();
        }

        this.webSocketStates.delete(sessionId);
    }
};
