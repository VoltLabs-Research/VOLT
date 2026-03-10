import {
    TEAM_CLUSTER_DAEMON_RESPONSE_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_END_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_EVENT,
    TEAM_CLUSTER_DAEMON_REQUEST_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_END_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACHED_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_END_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT,
    TeamClusterDaemonResponseType,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketRequestPayload,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonTerminalAttachPayload,
    type TeamClusterDaemonTerminalDetachPayload,
    type TeamClusterDaemonTerminalInputPayload,
    type TeamClusterDaemonTerminalResizePayload,
    type TeamClusterDaemonWebSocketAttachPayload,
    type TeamClusterDaemonWebSocketDataPayload,
    type TeamClusterDaemonWebSocketDetachPayload,
    type TeamClusterDaemonWebSocketStatePayload
} from '../contracts/reverseChannel';
import { DockerRuntimeService, type RuntimeTerminalAttachment } from '../infrastructure/docker/DockerRuntimeService';
import type { DaemonConfig } from '../core/config';

interface ReverseChannelSocketEmitter {
    emit(event: string, payload: unknown): void;
    on(event: string, listener: (payload: never) => void): void;
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
    onOpen: () => void;
    onMessage: (event: MessageEvent) => void;
    onError: () => void;
    onClose: (event: CloseEvent) => void;
};

export class ReverseChannelSocketBridge {
    private readonly terminalStates = new Map<string, ReverseChannelTerminalState>();
    private readonly webSocketStates = new Map<string, ReverseChannelWebSocketState>();

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService?: DockerRuntimeService
    ) {}

    async handleRequest(socket: ReverseChannelSocketEmitter, payload: TeamClusterDaemonSocketRequestPayload): Promise<void> {
        try {
            const url = this.buildRequestUrl(payload);
            const response = await fetch(url, {
                method: payload.method,
                headers: this.buildRequestHeaders(payload.headers, payload.body),
                body: payload.body ? JSON.stringify(payload.body) : undefined
            });

            if (payload.responseType === TeamClusterDaemonResponseType.Stream) {
                await this.handleStreamResponse(socket, payload.requestId, response);
                return;
            }

            if (payload.responseType === TeamClusterDaemonResponseType.Buffer) {
                const bodyBase64 = Buffer.from(await response.arrayBuffer()).toString('base64');
                const responsePayload: TeamClusterDaemonSocketResponsePayload = {
                    requestId: payload.requestId,
                    ok: response.ok,
                    status: response.status,
                    headers: this.readResponseHeaders(response.headers),
                    bodyBase64,
                    message: response.ok ? undefined : 'Daemon buffer request failed'
                };
                socket.emit(TEAM_CLUSTER_DAEMON_RESPONSE_EVENT, responsePayload);
                return;
            }

            const jsonPayload = await response.json();

            const responsePayload: TeamClusterDaemonSocketResponsePayload = {
                requestId: payload.requestId,
                ok: response.ok,
                status: response.status,
                headers: this.readResponseHeaders(response.headers),
                data: jsonPayload,
                message: response.ok ? undefined : this.readEnvelopeMessage(jsonPayload)
            };
            socket.emit(TEAM_CLUSTER_DAEMON_RESPONSE_EVENT, responsePayload);
        } catch (error: unknown) {
            const responsePayload: TeamClusterDaemonSocketResponsePayload = {
                requestId: payload.requestId,
                ok: false,
                status: 500,
                message: error instanceof Error ? error.message : 'Reverse channel request failed'
            };
            socket.emit(TEAM_CLUSTER_DAEMON_RESPONSE_EVENT, responsePayload);
        }
    }

    bindToSocket(socket: ReverseChannelSocketEmitter): void {
        socket.on(TEAM_CLUSTER_DAEMON_REQUEST_EVENT, async (payload) => {
            await this.handleRequest(socket, payload as TeamClusterDaemonSocketRequestPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT, async (payload) => {
            await this.handleTerminalAttach(socket, payload as TeamClusterDaemonTerminalAttachPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT, (payload) => {
            this.handleTerminalInput(payload as TeamClusterDaemonTerminalInputPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT, (payload) => {
            this.handleTerminalResize(payload as TeamClusterDaemonTerminalResizePayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT, (payload) => {
            this.handleTerminalDetach(payload as TeamClusterDaemonTerminalDetachPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT, (payload) => {
            this.handleWebSocketAttach(socket, payload as TeamClusterDaemonWebSocketAttachPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT, (payload) => {
            this.handleWebSocketInput(payload as TeamClusterDaemonWebSocketDataPayload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT, (payload) => {
            this.handleWebSocketDetach(payload as TeamClusterDaemonWebSocketDetachPayload);
        });
    }

    async handleTerminalAttach(socket: ReverseChannelSocketEmitter, payload: TeamClusterDaemonTerminalAttachPayload): Promise<void> {
        if (!this.dockerRuntimeService) {
            socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT, {
                sessionId: payload.sessionId,
                message: 'Docker runtime not available'
            });
            return;
        }

        try {
            const attachment = await this.dockerRuntimeService.attachTerminal(payload.containerId);
            const onData = (chunk: Buffer) => {
                socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT, {
                    sessionId: payload.sessionId,
                    chunkBase64: chunk.toString('base64')
                });
            };
            const onEnd = () => {
                socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_END_EVENT, {
                    sessionId: payload.sessionId
                });
                this.cleanupTerminalSession(payload.sessionId);
            };
            const onError = (error: Error) => {
                socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT, {
                    sessionId: payload.sessionId,
                    message: error.message
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

            socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT, {
                sessionId: payload.sessionId
            });
        } catch (error: unknown) {
            socket.emit(TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT, {
                sessionId: payload.sessionId,
                message: error instanceof Error ? error.message : 'Failed to attach terminal'
            });
        }
    }

    handleTerminalInput(payload: TeamClusterDaemonTerminalInputPayload): void {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return;
        }

        terminalState.attachment.stream.write(payload.input);
    }

    handleTerminalResize(payload: TeamClusterDaemonTerminalResizePayload): void {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return;
        }

        terminalState.attachment.exec.resize({
            h: payload.rows,
            w: payload.cols
        }).catch(() => {
        });
    }

    handleTerminalDetach(payload: TeamClusterDaemonTerminalDetachPayload): void {
        this.cleanupTerminalSession(payload.sessionId);
    }

    handleWebSocketAttach(socket: ReverseChannelSocketEmitter, payload: TeamClusterDaemonWebSocketAttachPayload): void {
        try {
            const webSocket = new WebSocket(payload.targetUrl);
            const onOpen = () => {
                socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACHED_EVENT, {
                    sessionId: payload.sessionId
                });
            };
            const onMessage = (event: MessageEvent) => {
                this.handleWebSocketMessage(socket, payload.sessionId, event).catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : 'Failed to proxy websocket message';
                    socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT, {
                        sessionId: payload.sessionId,
                        message
                    } satisfies TeamClusterDaemonWebSocketStatePayload);
                });
            };
            const onError = () => {
                socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT, {
                    sessionId: payload.sessionId,
                    message: 'Reverse channel websocket failed'
                } satisfies TeamClusterDaemonWebSocketStatePayload);
            };
            const onClose = (event: CloseEvent) => {
                socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_END_EVENT, {
                    sessionId: payload.sessionId,
                    code: event.code,
                    message: event.reason || undefined
                } satisfies TeamClusterDaemonWebSocketStatePayload);
                this.cleanupWebSocketSession(payload.sessionId);
            };

            webSocket.binaryType = 'arraybuffer';
            webSocket.addEventListener('open', onOpen);
            webSocket.addEventListener('message', onMessage);
            webSocket.addEventListener('error', onError);
            webSocket.addEventListener('close', onClose);

            this.webSocketStates.set(payload.sessionId, {
                sessionId: payload.sessionId,
                socket: webSocket,
                onOpen,
                onMessage,
                onError,
                onClose
            });
        } catch (error: unknown) {
            socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT, {
                sessionId: payload.sessionId,
                message: error instanceof Error ? error.message : 'Failed to attach websocket'
            } satisfies TeamClusterDaemonWebSocketStatePayload);
        }
    }

    handleWebSocketInput(payload: TeamClusterDaemonWebSocketDataPayload): void {
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

    handleWebSocketDetach(payload: TeamClusterDaemonWebSocketDetachPayload): void {
        const webSocketState = this.webSocketStates.get(payload.sessionId);
        if (!webSocketState) {
            return;
        }

        webSocketState.socket.close(1000, 'Detached');
        this.cleanupWebSocketSession(payload.sessionId);
    }

    cleanup(): void {
        for (const sessionId of Array.from(this.terminalStates.keys())) {
            this.cleanupTerminalSession(sessionId);
        }

        for (const sessionId of Array.from(this.webSocketStates.keys())) {
            this.cleanupWebSocketSession(sessionId);
        }
    }

    private async handleStreamResponse(
        socket: ReverseChannelSocketEmitter,
        requestId: string,
        response: Response
    ): Promise<void> {
        if (!response.ok || !response.body) {
            const message = await this.readResponseMessage(response);
            const errorPayload: TeamClusterDaemonSocketResponsePayload = {
                requestId,
                ok: false,
                status: response.status,
                headers: this.readResponseHeaders(response.headers),
                message
            };
            socket.emit(TEAM_CLUSTER_DAEMON_RESPONSE_EVENT, errorPayload);
            return;
        }

        const streamId = requestId;
        const responsePayload: TeamClusterDaemonSocketResponsePayload = {
            requestId,
            ok: true,
            status: response.status,
            headers: this.readResponseHeaders(response.headers),
            streamId
        };
        socket.emit(TEAM_CLUSTER_DAEMON_RESPONSE_EVENT, responsePayload);

        const reader = response.body.getReader();
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }

                const streamPayload: TeamClusterDaemonSocketStreamPayload = {
                    requestId,
                    streamId,
                    chunkBase64: Buffer.from(chunk.value).toString('base64')
                };
                socket.emit(TEAM_CLUSTER_DAEMON_STREAM_EVENT, streamPayload);
            }

            const endPayload: TeamClusterDaemonSocketStreamStatePayload = {
                requestId,
                streamId
            };
            socket.emit(TEAM_CLUSTER_DAEMON_STREAM_END_EVENT, endPayload);
        } catch (error: unknown) {
            const errorPayload: TeamClusterDaemonSocketStreamStatePayload = {
                requestId,
                streamId,
                message: error instanceof Error ? error.message : 'Failed to proxy daemon stream'
            };
            socket.emit(TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT, errorPayload);
        } finally {
            reader.releaseLock();
        }
    }

    private async handleWebSocketMessage(
        socket: ReverseChannelSocketEmitter,
        sessionId: string,
        event: MessageEvent
    ): Promise<void> {
        const message = await this.readWebSocketMessage(event.data);
        const payload: TeamClusterDaemonWebSocketDataPayload = {
            sessionId,
            chunkBase64: message.data.toString('base64'),
            isBinary: message.isBinary
        };
        socket.emit(TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT, payload);
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

        webSocketState.socket.removeEventListener('open', webSocketState.onOpen);
        webSocketState.socket.removeEventListener('message', webSocketState.onMessage);
        webSocketState.socket.removeEventListener('error', webSocketState.onError);
        webSocketState.socket.removeEventListener('close', webSocketState.onClose);

        if (webSocketState.socket.readyState === WebSocket.OPEN || webSocketState.socket.readyState === WebSocket.CONNECTING) {
            webSocketState.socket.close();
        }

        this.webSocketStates.delete(sessionId);
    }

    private buildRequestUrl(payload: TeamClusterDaemonSocketRequestPayload): URL {
        if (payload.targetUrl) {
            return new URL(payload.targetUrl);
        }

        const normalizedPath = this.buildPathWithQuery(payload.path, payload.query);
        return new URL(normalizedPath, `http://${this.config.host}:${this.config.port}`);
    }

    private buildRequestHeaders(
        headers?: TeamClusterDaemonSocketHeaders,
        body?: Record<string, unknown>
    ): HeadersInit {
        const requestHeaders: TeamClusterDaemonSocketHeaders = {
            authorization: `Bearer ${this.config.daemonPassword}`
        };

        if (body) {
            requestHeaders['content-type'] = 'application/json';
        }

        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                requestHeaders[key] = value;
            }
        }

        return requestHeaders;
    }

    private readResponseHeaders(headers: Headers): TeamClusterDaemonSocketHeaders {
        const responseHeaders: TeamClusterDaemonSocketHeaders = {};
        headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        return responseHeaders;
    }

    private buildPathWithQuery(
        path: string,
        query?: Record<string, string | number | boolean | undefined>
    ): string {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const url = new URL(normalizedPath, 'http://daemon.local');

        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value === undefined) {
                    continue;
                }

                url.searchParams.set(key, String(value));
            }
        }

        return `${url.pathname}${url.search}`;
    }

    private async readResponseMessage(response: Response): Promise<string> {
        try {
            const payload = await response.json();
            return this.readEnvelopeMessage(payload) || `Daemon request failed with status ${response.status}`;
        } catch {
            return `Daemon request failed with status ${response.status}`;
        }
    }

    private readEnvelopeMessage(payload: unknown): string | undefined {
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            return undefined;
        }

        const message = Reflect.get(payload, 'message');
        if (typeof message === 'string') {
            return message;
        }

        return undefined;
    }
};
