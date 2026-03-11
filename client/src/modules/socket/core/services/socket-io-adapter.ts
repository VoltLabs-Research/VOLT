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
            this.connect();
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

        this.cleanupSocket();
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                this.socket = io(this.connectionUrl, {
                    path: this.options.path,
                    timeout: this.options.timeout,
                    auth: this.options.auth,
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 30000,
                    randomizationFactor: 0.5
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT, () => {
                    this.handleConnect();
                    resolve();
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT_ERROR, (error) => {
                    this.connectionPromise = null;
                    this.handleConnectError(error);
                    reject(error);
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.DISCONNECT, () => {
                    this.connectionPromise = null;
                    this.handleDisconnect();
                });
            } catch (error) {
                this.connectionPromise = null;
                this.setConnectionStatus(SocketConnectionStatus.Error);
                reject(error);
            }
        });

        return this.connectionPromise;
    }

    disconnect(): void {
        this.connectionPromise = null;
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

    emit<T = unknown>(event: string, data?: unknown): Promise<T> {
        if (!event) {
            return Promise.reject(new Error('Event name is required'));
        }

        if (!this.socket?.connected) {
            return Promise.reject(new Error('Socket is not connected'));
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket!.emit(event, data, (response: T) => {
                    resolve(response);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    updateAuth(auth: Record<string, unknown>): void {
        this.options.auth = { ...auth };

        if (this.socket?.connected) {
            this.disconnect();
            this.connect().catch(console.warn);
        }
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
        this.connectionPromise = null;
        this.connectErrorAttempts = 0;
        this.hasConnectedOnce = true;
        this.setConnectionStatus(SocketConnectionStatus.Connected);
        this.notifyConnectionListeners(true);
        this.resubscribeToEvents();
    }

    private handleConnectError(error?: Error): void {
        this.connectErrorAttempts++;
        const transport = (this.socket?.io as { engine?: { transport?: { name?: string } } })?.engine?.transport?.name ?? 'unknown';
        console.warn(
            `[SocketIOAdapter] connect_error (attempt #${this.connectErrorAttempts}): ${error?.message ?? 'unknown'} | transport: ${transport} | url: ${this.connectionUrl}`
        );
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
