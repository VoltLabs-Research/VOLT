import { SOCKET_CONNECTION_EVENTS } from '../constants/socket-connection-events';
import { SocketConnectionStatus } from '../socket-connection-status';
import { io, Socket } from 'socket.io-client';
import type { EventSubscription, ISocketService, SocketOptions } from './contracts/socket-service';

class SocketIOAdapter implements ISocketService {
    private socket: Socket | null = null;
    private subscriptions: EventSubscription[] = [];
    private connectionUrl: string;
    private options: SocketOptions;
    private connectionPromise: Promise<void> | null = null;
    private pendingResolve: (() => void) | null = null;
    private pendingReject: ((reason?: unknown) => void) | null = null;
    private connectionListeners: Array<(connected: boolean) => void> = [];
    private connectionStatus = SocketConnectionStatus.Disconnected;
    private connectionStatusListeners: Array<(status: SocketConnectionStatus) => void> = [];
    private hasConnectedOnce = false;
    private connectErrorAttempts = 0;

    constructor(baseUrl: string, options: SocketOptions = {}) {
        this.connectionUrl = options.url ?? baseUrl;
        this.options = {
            path: options.path ?? '/socket.io',
            autoConnect: options.autoConnect ?? false,
            timeout: options.timeout ?? 20000,
            auth: options.auth ?? {}
        };

        if (this.options.autoConnect) {
            this.setConnectionStatus(SocketConnectionStatus.Connecting);
            this.connect().catch(() => undefined);
        }
    }

    connect(): Promise<void> {
        if (this.socket?.connected) {
            return Promise.resolve();
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.setConnectionStatus(this.hasConnectedOnce ? SocketConnectionStatus.Reconnecting : SocketConnectionStatus.Connecting);

        this.connectionPromise = new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;

            try {
                if (!this.socket) {
                    this.initializeSocket();
                } else if (!this.socket.active) {
                    this.socket.connect();
                }
            } catch (error) {
                this.clearPendingConnection();
                this.setConnectionStatus(SocketConnectionStatus.Error);
                reject(error);
            }
        });

        return this.connectionPromise;
    }

    disconnect(): void {
        if (this.pendingReject) {
            this.pendingReject(new Error('Socket disconnected'));
        }
        this.clearPendingConnection();
        this.cleanupSocket();
        this.setConnectionStatus(SocketConnectionStatus.Disconnected);
        this.notifyConnectionListeners(false);
    }

    isConnected(): boolean {
        return !!this.socket?.connected;
    }

    getConnectionStatus(): SocketConnectionStatus {
        return this.connectionStatus;
    }

    on<TArgs extends unknown[]>(event: string, callback: (...args: TArgs) => void): () => void;
    on(event: string, callback: (...args: unknown[]) => void): () => void {
        if (!event || typeof callback !== 'function') {
            throw new Error('Event name and callback function are required');
        }

        const existingSubscription = this.subscriptions.find(
            (sub) => sub.event === event && sub.callback === callback
        );

        if (existingSubscription) {
            return () => {
                this.off(event, callback);
            };
        }

        const subscription: EventSubscription = { event, callback };
        this.subscriptions.push(subscription);

        if (this.socket) {
            this.socket.on(event, callback);
        }

        return () => {
            this.off(event, callback);
        };
    }

    off<TArgs extends unknown[]>(event: string, callback?: (...args: TArgs) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void {
        if (!event) return;

        if (callback) {
            this.subscriptions = this.subscriptions.filter(
                (sub) => sub.event !== event || sub.callback !== callback
            );
        } else {
            this.subscriptions = this.subscriptions.filter((sub) => sub.event !== event);
        }

        if (this.socket) {
            if (callback) {
                this.socket.off(event, callback);
            } else {
                this.socket.off(event);
            }
        }
    }

    private static readonly ACK_TIMEOUT_MS = 30_000;

    emit<T = unknown>(event: string, data?: unknown): Promise<T> {
        if (!event) {
            return Promise.reject(new Error('Event name is required'));
        }

        if (!this.socket?.connected) {
            return Promise.reject(new Error('Socket is not connected'));
        }

        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(`Ack timeout for event "${event}" after ${SocketIOAdapter.ACK_TIMEOUT_MS}ms`));
                }
            }, SocketIOAdapter.ACK_TIMEOUT_MS);

            try {
                this.socket!.emit(event, data, (response: T) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve(response);
                    }
                });
            } catch (error) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                }
            }
        });
    }

    emitWithoutAck(event: string, data?: unknown): void {
        if (!event || !this.socket?.connected) {
            return;
        }

        this.socket.emit(event, data);
    }

    updateAuth(auth: Record<string, unknown>): void {
        const next = { ...auth };
        const previous = (this.options.auth ?? {}) as Record<string, unknown>;
        const unchanged = this.authEquals(previous, next);

        this.options.auth = next;

        if (!this.socket) return;

        (this.socket.auth as Record<string, unknown>) = next;

        if (unchanged) return;

        if (this.socket.connected) {
            this.disconnect();
            this.connect().catch(console.warn);
        }
    }

    private authEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
        const keysA = Object.keys(a);
        return keysA.length === Object.keys(b).length
            && keysA.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]));
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        this.connectionListeners.push(listener);
        return () => {
            this.connectionListeners = this.connectionListeners.filter((l) => l !== listener);
        };
    }

    onConnectionStatusChange(listener: (status: SocketConnectionStatus) => void): () => void {
        this.connectionStatusListeners.push(listener);
        return () => {
            this.connectionStatusListeners = this.connectionStatusListeners.filter((currentListener) => currentListener !== listener);
        };
    }

    private handleConnect(): void {
        this.pendingResolve?.();
        this.clearPendingConnection();
        this.connectErrorAttempts = 0;
        this.hasConnectedOnce = true;
        this.setConnectionStatus(SocketConnectionStatus.Connected);
        this.resubscribeToEvents();
        this.notifyConnectionListeners(true);
    }

    private handleConnectError(error?: Error): void {
        this.connectErrorAttempts++;
        const transport = (this.socket?.io as { engine?: { transport?: { name?: string } } })?.engine?.transport?.name ?? 'unknown';
        console.warn(
            `[SocketIOAdapter] connect_error (attempt #${this.connectErrorAttempts}): ${error?.message ?? 'unknown'} | transport: ${transport} | url: ${this.connectionUrl}`
        );
        this.pendingReject?.(error ?? new Error('Socket connection failed'));
        this.clearPendingConnection();
        this.setConnectionStatus(this.hasConnectedOnce ? SocketConnectionStatus.Reconnecting : SocketConnectionStatus.Error);
        this.notifyConnectionListeners(false);
    }

    private handleDisconnect(): void {
        const nextStatus = this.socket?.active
            ? SocketConnectionStatus.Reconnecting
            : SocketConnectionStatus.Disconnected;

        this.setConnectionStatus(nextStatus);
        this.notifyConnectionListeners(false);
    }

    private cleanupSocket(): void {
        if (!this.socket) {
            return;
        }

        this.socket.io.removeAllListeners();
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
    }

    private initializeSocket(): void {
        this.cleanupSocket();
        this.socket = io(this.connectionUrl, {
            path: this.options.path,
            timeout: this.options.timeout,
            auth: this.options.auth,
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5
        });

        this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT, () => {
            this.handleConnect();
        });

        this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT_ERROR, (error) => {
            this.handleConnectError(error);
        });

        this.socket.on(SOCKET_CONNECTION_EVENTS.DISCONNECT, () => {
            this.handleDisconnect();
        });
    }

    private clearPendingConnection(): void {
        this.pendingResolve = null;
        this.pendingReject = null;
        this.connectionPromise = null;
    }

    private resubscribeToEvents(): void {
        if (!this.socket) return;

        this.subscriptions.forEach((sub) => {
            if (this.socket) {
                this.socket.off(sub.event, sub.callback);
                this.socket.on(sub.event, sub.callback);
            }
        });
    }

    private notifyConnectionListeners(connected: boolean): void {
        this.connectionListeners.forEach((listener) => {
            try {
                listener(connected);
            } catch {
            }
        });
    }

    private setConnectionStatus(status: SocketConnectionStatus): void {
        if (this.connectionStatus === status) {
            return;
        }

        this.connectionStatus = status;
        this.connectionStatusListeners.forEach((listener) => {
            try {
                listener(status);
            } catch {
            }
        });
    }
};

export default SocketIOAdapter;
