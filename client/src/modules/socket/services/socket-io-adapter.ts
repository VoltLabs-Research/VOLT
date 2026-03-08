import { io, Socket } from 'socket.io-client';
import type { ISocketService, SocketOptions, EventSubscription } from '../api/entities/socket-service';
import { SOCKET_CONNECTION_EVENTS } from '../api/entities/socket-constants';

class SocketIOAdapter implements ISocketService {
    private socket: Socket | null = null;
    private subscriptions: EventSubscription[] = [];
    private connectionUrl: string;
    private options: SocketOptions;
    private connecting: boolean = false;
    private connectionListeners: Array<(connected: boolean) => void> = [];

    constructor(baseUrl: string, options: SocketOptions = {}) {
        this.connectionUrl = options.url ?? baseUrl;
        this.options = {
            path: options.path ?? '/socket.io',
            autoConnect: options.autoConnect ?? true,
            timeout: options.timeout ?? 20000,
            auth: options.auth ?? {}
        };

        if (this.options.autoConnect) {
            this.connect();
        }
    }

    connect(): Promise<void> {
        if (this.socket?.connected || this.connecting) {
            return Promise.resolve();
        }

        this.cleanupSocket();
        this.connecting = true;

        return new Promise((resolve, reject) => {
            try {
                this.socket = io(this.connectionUrl, {
                    path: this.options.path,
                    timeout: this.options.timeout,
                    auth: this.options.auth,
                    transports: ['websocket', 'polling']
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT, () => {
                    this.handleConnect();
                    resolve();
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.CONNECT_ERROR, (error) => {
                    this.connecting = false;
                    reject(error);
                });

                this.socket.on(SOCKET_CONNECTION_EVENTS.DISCONNECT, () => {
                    this.connecting = false;
                    this.notifyConnectionListeners(false);
                });
            } catch (error) {
                this.connecting = false;
                reject(error);
            }
        });
    }

    disconnect(): void {
        this.connecting = false;
        this.cleanupSocket();
        this.notifyConnectionListeners(false);
    }

    isConnected(): boolean {
        return !!this.socket?.connected;
    }

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

        const subscription: EventSubscription = { event, callback: callback as (...args: unknown[]) => void };
        this.subscriptions.push(subscription);

        if (this.socket) {
            this.socket.on(event, callback);
        }

        return () => {
            this.off(event, callback);
        };
    }

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
        this.options.auth = { ...this.options.auth, ...auth };

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

    private handleConnect(): void {
        this.connecting = false;
        this.notifyConnectionListeners(true);
        this.resubscribeToEvents();
    }

    private cleanupSocket(): void {
        if (!this.socket) {
            return;
        }

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
}

export default SocketIOAdapter;
