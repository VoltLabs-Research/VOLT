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

    private readonly pending = new Map<string, PendingCommand>();

    constructor(
        private readonly controlSocketUrl: string,
        private readonly socketOptions: SocketOptions,
        private readonly callbacks: ControlSocketManagerCallbacks
    ) {}

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

    setBridge(bridge: ReverseChannelBridge): void {
        this.bridge = bridge;
    }

    disconnect(): void {
        this.registered = false;
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.socket = null;
        this.rejectAllPending(DaemonClientError.socketNotReady());
    }

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

    private rejectAllPending(error: DaemonClientError): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
            entry.reject(error);
        }
        this.pending.clear();
    }

    emit(message: TeamClusterDaemonMessage): void {
        if (!this.socket) {
            throw DaemonClientError.emitFailed();
        }

        this.socket.emit(DaemonSocketEvent.TeamClusterDaemonMessage, message);
    }

    isReady(): boolean {
        return this.registered;
    }
};
