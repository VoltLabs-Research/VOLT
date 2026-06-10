import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import crypto from 'node:crypto';
import { DaemonClientError } from '../errors/DaemonClientError';
import { DaemonSocketEvent, REVERSE_CHANNEL } from '../contracts/index';
import type { SocketOptions } from './types';
import type { TeamClusterDaemonMessage, TeamClusterDaemonSocketResponsePayload } from '../contracts/reverseChannel';
import type { ReverseChannelBridge } from '../reverse-channel/ReverseChannelBridge';

interface CommandResponseEnvelope<T> {
    status: string;
    data: T;
};

interface ControlSocketManagerCallbacks {
    onConnected: () => void;
    onDisconnected: (reason: string) => void;
    onError: (err: DaemonClientError) => void;
};

/**
 * Manages the socket.io-client control connection to the Volt server.
 *
 * Responsibilities:
 * - Establish and maintain the `socket.io` connection.
 * - Emit `team-cluster-daemon:register` on each (re)connect.
 * - Forward inbound `team-cluster-daemon:message` events to the bridge.
 * - Implement outbound `sendCommand` with request/response semantics and timeout.
 * - Emit arbitrary outbound messages via `emit`.
 */
interface PendingCommand {
    command: string;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
};

export class ControlSocketManager {
    private socket: Socket | null = null;
    private registered = false;
    private activeSocketId = 0;
    private bridge: ReverseChannelBridge | null = null;

    /** In-flight request/response commands keyed by requestId (single dispatcher). */
    private readonly pending = new Map<string, PendingCommand>();

    constructor(
        private readonly controlSocketUrl: string,
        private readonly socketOptions: SocketOptions,
        private readonly callbacks: ControlSocketManagerCallbacks
    ) {}

    /**
     * Establishes the socket.io connection and waits for the server to
     * acknowledge the `team-cluster-daemon:registered` event.
     *
     * @param teamClusterId - Cluster identifier sent in the register payload.
     * @param daemonPassword - Current (possibly just-rotated) daemon password.
     * @throws {DaemonClientError} with code `SOCKET_CONNECTION_FAILED` on initial connect error.
     */
    connect(teamClusterId: string, daemonPassword: string): Promise<void> {
        this.registered = false;
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.rejectAllPending(DaemonClientError.socketNotReady());

        const socketId = ++this.activeSocketId;

        const socket = io(this.controlSocketUrl, {
            autoConnect: true,
            forceNew: true,
            reconnection: this.socketOptions.reconnect !== false,
            reconnectionAttempts: this.socketOptions.maxReconnectAttempts ?? Infinity,
            reconnectionDelay: this.socketOptions.reconnectBaseDelayMs ?? 500,
            reconnectionDelayMax: this.socketOptions.reconnectMaxDelayMs ?? 30_000,
            randomizationFactor: this.socketOptions.randomizationFactor ?? 0.3
        });

        this.socket = socket;

        // Single persistent response dispatcher: routes every inbound response
        // to its waiting command by requestId, instead of one listener per call.
        socket.on(DaemonSocketEvent.TeamClusterDaemonMessage, (message: unknown) =>
            this.dispatchResponse(socketId, message)
        );

        return new Promise<void>((resolve, reject) => {
            let resolved = false;

            const finishOnce = (fn: () => void) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                fn();
            };

            socket.on('connect', () => {
                socket.emit(DaemonSocketEvent.TeamClusterDaemonRegister, {
                    teamClusterId,
                    daemonPassword
                });
            });

            socket.on(DaemonSocketEvent.TeamClusterDaemonRegistered, () => {
                if (this.activeSocketId !== socketId) {
                    return;
                }

                this.registered = true;
                this.callbacks.onConnected();
                finishOnce(resolve);
            });

            socket.on('disconnect', (reason: string) => {
                if (this.activeSocketId !== socketId) {
                    return;
                }

                this.registered = false;
                this.bridge?.cleanup();
                this.rejectAllPending(DaemonClientError.socketNotReady());
                this.callbacks.onDisconnected(reason);
            });

            socket.on('connect_error', (error: Error) => {
                if (this.activeSocketId !== socketId) {
                    return;
                }

                const clientError = DaemonClientError.socketConnectionFailed(
                    `Control socket connection error: ${error.message}`,
                    error
                );
                this.callbacks.onError(clientError);
                finishOnce(() => reject(clientError));
            });

            if (this.bridge) {
                this.bridge.bindToSocket(socket, socketId, () => this.activeSocketId);
            }
        });
    }

    /**
     * Registers the reverse-channel bridge so it is automatically rebound
     * whenever a new socket is created (initial connect and reconnections).
     */
    setBridge(bridge: ReverseChannelBridge): void {
        this.bridge = bridge;
    }

    /** Gracefully disconnects the socket and clears internal state. */
    disconnect(): void {
        this.registered = false;
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.socket = null;
        this.rejectAllPending(DaemonClientError.socketNotReady());
    }

    /**
     * Sends a command to the server and waits for the corresponding response.
     *
     * Uses a UUID-keyed request/response pattern over the
     * `team-cluster-daemon:message` event with an optional timeout.
     *
     * @param command - Command name, e.g. `"runtime.heartbeat"`.
     * @param payload - Arbitrary command payload.
     * @param timeoutMs - Override the per-call timeout in milliseconds.
     * @returns The `data.data` field from the server response envelope.
     * @throws {DaemonClientError} `SOCKET_NOT_READY` when not connected.
     * @throws {DaemonClientError} `COMMAND_TIMEOUT` when no response arrives in time.
     * @throws {DaemonClientError} `COMMAND_REJECTED` when the server returns `ok: false`.
     */
    sendCommand<T>(command: string, payload?: object, timeoutMs?: number): Promise<T | undefined> {
        if (!this.socket || !this.registered) {
            return Promise.reject(DaemonClientError.socketNotReady());
        }

        const requestId = crypto.randomUUID();
        const effectiveTimeout = timeoutMs ?? 30_000;

        return new Promise<T | undefined>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(DaemonClientError.commandTimeout(command));
            }, effectiveTimeout);

            this.pending.set(requestId, {
                command,
                resolve: (value) => resolve(value as T | undefined),
                reject,
                timer
            });

            this.socket?.emit(DaemonSocketEvent.TeamClusterDaemonMessage, {
                type: 'command',
                requestId,
                command,
                responseType: REVERSE_CHANNEL.ResponseType.Json,
                payload
            });
        });
    }

    /** Routes a single inbound message to the command waiting on its requestId. */
    private dispatchResponse(socketId: number, message: unknown): void {
        if (this.activeSocketId !== socketId) {
            return;
        }
        if (typeof message !== 'object' || message === null || Array.isArray(message)) {
            return;
        }

        const typed = message as TeamClusterDaemonSocketResponsePayload<CommandResponseEnvelope<unknown>>;
        if (typed.type !== 'response') {
            return;
        }

        const entry = this.pending.get(typed.requestId);
        if (!entry) {
            return;
        }

        clearTimeout(entry.timer);
        this.pending.delete(typed.requestId);

        if (!typed.ok) {
            entry.reject(DaemonClientError.commandRejected(entry.command, typed.message));
            return;
        }

        entry.resolve(typed.data?.data);
    }

    /** Rejects and clears every in-flight command (on disconnect / reconnect). */
    private rejectAllPending(error: DaemonClientError): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
            entry.reject(error);
        }
        this.pending.clear();
    }

    /**
     * Emits an arbitrary outbound message on the control socket without waiting
     * for a response. Used for fire-and-forget notifications such as exposure
     * snapshots and session data chunks.
     *
     * @throws {DaemonClientError} `EMIT_FAILED` when the socket is not connected.
     */
    emit(message: TeamClusterDaemonMessage): void {
        if (!this.socket) {
            throw DaemonClientError.emitFailed();
        }

        this.socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, message);
    }

    /** Returns whether the socket is connected and the register ACK was received. */
    isReady(): boolean {
        return this.registered;
    }
};
