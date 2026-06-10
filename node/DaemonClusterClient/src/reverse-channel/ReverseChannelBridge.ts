import crypto from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { DaemonSocketEvent, REVERSE_CHANNEL } from '../contracts/index';
import { DaemonClientError } from '../errors/DaemonClientError';
import type { ReverseChannelHandler } from './ReverseChannelHandler';
import type { CommandResult } from './types';
import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonCommandMessage,
    TeamClusterDaemonSocketResponsePayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonSocketStreamStatePayload
} from '../contracts/reverseChannel';

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, TeamClusterDaemonCommandMessage>;

/**
 * Listens on the control socket for inbound `team-cluster-daemon:message` events
 * and dispatches `command` type messages to registered handlers.
 *
 * All other message types (session-input, tunnel-open, etc.) are forwarded to
 * consumers via `onMessage()` callbacks - the bridge never interprets them.
 *
 * Handlers are registered once and survive socket reconnections because the
 * `ControlSocketManager` calls `bindToSocket()` on each new socket instance.
 */
export class ReverseChannelBridge {
    private readonly handlers = new Map<string, ReverseChannelHandler>();
    private readonly messageListeners: Array<(message: NonCommandMessage) => void> = [];
    private readonly errorListeners: Array<(err: DaemonClientError) => void> = [];

    registerHandler(command: string, handler: ReverseChannelHandler): void {
        this.handlers.set(command, handler);
    }

    unregisterHandler(command: string): void {
        this.handlers.delete(command);
    }

    onMessage(listener: (message: NonCommandMessage) => void): void {
        this.messageListeners.push(listener);
    }

    onError(listener: (err: DaemonClientError) => void): void {
        this.errorListeners.push(listener);
    }

    /**
     * Attaches this bridge to the provided socket.
     * Called by `ControlSocketManager` on every (re)connect - the same handler
     * registry is reused, so callers only register handlers once.
     *
     * @param socket - The newly created socket.io-client `Socket`.
     * @param socketId - Sequence id of this socket; used to ignore stale events after reconnect.
     * @param getActiveSocketId - Returns the current active socket id from `ControlSocketManager`.
     */
    bindToSocket(
        socket: Socket,
        socketId: number,
        getActiveSocketId: () => number
    ): void {
        socket.on(DaemonSocketEvent.TeamClusterDaemonMessage, async (message: TeamClusterDaemonMessage) => {
            if (getActiveSocketId() !== socketId) {
                return;
            }

            if (message.type === 'command') {
                await this.handleCommand(socket, message);
                return;
            }

            this.forwardMessage(message as NonCommandMessage);
        });
    }

    /** Clears all session state. Called by `ControlSocketManager` on disconnect. */
    cleanup(): void {
        // Handler registry is intentionally preserved across reconnections.
        // Stateful session maps live in the daemon's ReverseChannelSocketBridge, not here.
    }

    private async handleCommand(socket: Socket, message: TeamClusterDaemonCommandMessage): Promise<void> {
        const handler = this.handlers.get(message.command);

        if (!handler) {
            this.sendResponse(socket, {
                type: 'response',
                requestId: message.requestId,
                ok: false,
                status: 404,
                message: `Unknown daemon command: ${message.command}`
            });
            return;
        }

        let result: CommandResult;

        try {
            result = await handler.handle(message.payload, {
                command: message.command,
                requestId: message.requestId
            });
        } catch (error: unknown) {
            const clientError = DaemonClientError.handlerError(message.command, error);
            this.notifyError(clientError);
            this.sendResponse(socket, {
                type: 'response',
                requestId: message.requestId,
                ok: false,
                status: 500,
                message: clientError.message
            });
            return;
        }

        if (message.responseType === REVERSE_CHANNEL.ResponseType.Stream && result.stream) {
            await this.streamResponse(socket, message.requestId, result.stream, result.status ?? 200, result.headers);
            return;
        }

        if (message.responseType === REVERSE_CHANNEL.ResponseType.Buffer && result.body) {
            this.sendResponse(socket, {
                type: 'response',
                requestId: message.requestId,
                ok: true,
                status: result.status ?? 200,
                headers: result.headers,
                bodyBase64: result.body.toString('base64')
            });
            return;
        }

        this.sendResponse(socket, {
            type: 'response',
            requestId: message.requestId,
            ok: true,
            status: result.status ?? 200,
            headers: result.headers,
            data: {
                status: 'success',
                data: result.data
            }
        });
    }

    private async streamResponse(
        socket: Socket,
        requestId: string,
        stream: ReadableStream<Uint8Array>,
        status: number,
        headers: Record<string, string> | undefined
    ): Promise<void> {
        const streamId = crypto.randomUUID();

        this.sendResponse(socket, {
            type: 'response',
            requestId,
            ok: true,
            status,
            headers,
            streamId
        });

        try {
            const reader = stream.getReader();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk: TeamClusterDaemonSocketStreamPayload = {
                    type: 'stream',
                    requestId,
                    streamId,
                    chunkBase64: Buffer.from(value).toString('base64')
                };

                socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, chunk);
            }
        } catch (error: unknown) {
            const endPayload: TeamClusterDaemonSocketStreamStatePayload = {
                type: 'stream-end',
                requestId,
                streamId,
                message: error instanceof Error ? error.message : String(error)
            };

            socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, endPayload);
            return;
        }

        const endPayload: TeamClusterDaemonSocketStreamStatePayload = {
            type: 'stream-end',
            requestId,
            streamId
        };

        socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, endPayload);
    }

    private sendResponse(socket: Socket, payload: TeamClusterDaemonSocketResponsePayload): void {
        socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, payload);
    }

    private forwardMessage(message: NonCommandMessage): void {
        for (const listener of this.messageListeners) {
            listener(message);
        }
    }

    private notifyError(error: DaemonClientError): void {
        for (const listener of this.errorListeners) {
            listener(error);
        }
    }
};
