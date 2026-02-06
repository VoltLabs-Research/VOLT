import { io, Socket } from 'socket.io-client';
import ISocketService, { SocketOptions, EventSubscription } from '../../domain/ports/ISocketService';

export default class SocketIOAdapter implements ISocketService{
    private socket: Socket | null = null;
    private subscriptions: EventSubscription[] = [];
    private connectionUrl: string;
    private options: SocketOptions;
    private connectionAttempts: number = 0;
    private maxReconnectionAttempts: number;
    private autoReconnect: boolean;
    private connecting: boolean = false;
    private manualDisconnect: boolean = false;
    private connectionListeners: Array<(connected: boolean) => void> = [];
    private currentTeamId: string | null = null;

    constructor(baseUrl: string, options: SocketOptions = {}){
        this.connectionUrl = options.url ?? baseUrl;
        this.options = {
            path: options.path ?? '/socket.io',
            autoConnect: options.autoConnect ?? true,
            reconnection: options.reconnection ?? true,
            reconnectionAttempts: options.reconnectionAttempts ?? Infinity,
            reconnectionDelay: options.reconnectionDelay ?? 1000,
            timeout: options.timeout ?? 20000,
            auth: options.auth ?? {}
        };
        this.maxReconnectionAttempts = this.options.reconnectionAttempts ?? Infinity;
        this.autoReconnect = this.options.reconnection ?? true;

        if(this.options.autoConnect){
            this.connect();
        }
    }

    connect(): Promise<void>{
        if(this.socket?.connected || this.connecting){
            return Promise.resolve();
        }

        this.connecting = true;
        this.manualDisconnect = false;

        return new Promise((resolve, reject) => {
            try{
                this.socket = io(this.connectionUrl, {
                    path: this.options.path,
                    reconnection: this.options.reconnection,
                    reconnectionAttempts: this.options.reconnectionAttempts,
                    reconnectionDelay: this.options.reconnectionDelay,
                    timeout: this.options.timeout,
                    auth: this.options.auth,
                    transports: ['websocket', 'polling']
                });

                this.socket.on('connect', () => {
                    this.handleConnect();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    this.handleConnectError(error, reject);
                });

                this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
            }catch(error){
                this.connecting = false;
                reject(error);
            }
        });
    }

    disconnect(): void{
        if(!this.socket) return;
        this.manualDisconnect = true;
        this.socket.disconnect();
        this.notifyConnectionListeners(false);
    }

    isConnected(): boolean{
        return !!this.socket?.connected;
    }

    on(event: string, callback: (...args: unknown[]) => void): () => void{
        if(!event || typeof callback !== 'function'){
            throw new Error('Event name and callback function are required');
        }

        const existingSubscription = this.subscriptions.find(
            (sub) => sub.event === event && sub.callback === callback
        );

        if(existingSubscription){
            return () => {
                this.off(event, callback);
            };
        }

        const subscription: EventSubscription = { event, callback: callback as (...args: unknown[]) => void };
        this.subscriptions.push(subscription);

        if(this.socket){
            this.socket.on(event, callback);
        }

        return () => {
            this.off(event, callback);
        };
    }

    off(event: string, callback?: (...args: unknown[]) => void): void{
        if(!event) return;

        if(callback){
            this.subscriptions = this.subscriptions.filter(
                (sub) => sub.event !== event || sub.callback !== callback
            );
        }else{
            this.subscriptions = this.subscriptions.filter((sub) => sub.event !== event);
        }

        if(this.socket){
            if(callback){
                this.socket.off(event, callback);
            }else{
                this.socket.off(event);
            }
        }
    }

    emit<T = unknown>(event: string, data?: unknown): Promise<T>{
        if(!event){
            return Promise.reject(new Error('Event name is required'));
        }

        if(!this.socket?.connected){
            return Promise.reject(new Error('Socket is not connected'));
        }

        return new Promise((resolve, reject) => {
            try{
                this.socket!.emit(event, data, (response: T) => {
                    resolve(response);
                });
            }catch(error){
                reject(error);
            }
        });
    }

    updateAuth(auth: Record<string, unknown>): void{
        this.options.auth = { ...this.options.auth, ...auth };

        if(this.socket?.connected){
            this.disconnect();
            this.connect().catch(console.error);
        }
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void{
        this.connectionListeners.push(listener);
        return () => {
            this.connectionListeners = this.connectionListeners.filter((l) => l !== listener);
        };
    }

    subscribeToTeam(teamId: string, previousTeamId?: string): void{
        if(!this.socket?.connected){
            console.error('Cannot subscribe to team: Socket not connected');
            return;
        }

        this.currentTeamId = teamId;
        this.socket.emit('subscribe_to_team', { teamId, previousTeamId });
    }

    private handleConnect(): void{
        this.connectionAttempts = 0;
        this.connecting = false;
        this.notifyConnectionListeners(true);
        this.resubscribeToEvents();

        if(this.currentTeamId){
            this.socket?.emit('subscribe_to_team', { teamId: this.currentTeamId });
        }
    }

    private handleDisconnect(reason: string): void{
        this.notifyConnectionListeners(false);

        if(reason !== 'io client disconnect' && !this.manualDisconnect && this.autoReconnect){
            this.connect().catch(console.error);
        }
    }

    private handleConnectError(error: Error, reject?: (reason?: unknown) => void): void{
        this.connectionAttempts += 1;

        if(this.connectionAttempts >= this.maxReconnectionAttempts){
            this.connecting = false;
            if(reject){
                reject(new Error(`Failed to connect after ${this.maxReconnectionAttempts} attempts: ${error.message}`));
            }
        }
    }

    private resubscribeToEvents(): void{
        if(!this.socket) return;

        this.subscriptions.forEach((sub) => {
            if(this.socket){
                // Remove existing listener first to prevent duplicates
                this.socket.off(sub.event, sub.callback);
                this.socket.on(sub.event, sub.callback);
            }
        });
    }

    private notifyConnectionListeners(connected: boolean): void{
        this.connectionListeners.forEach((listener) => {
            try{
                listener(connected);
            }catch(error){
                console.error('Error in connection listener:', error);
            }
        });
    }
};
