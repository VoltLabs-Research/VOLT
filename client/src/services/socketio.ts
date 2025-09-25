/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { io, Socket } from 'socket.io-client';
import Logger from '@/services/logger';

export interface SocketOptions{
    url?: string;
    path?: string;
    auth?: Record<string, any>;
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    timeout?: number;
}

export interface EventSubscription{
    event: string;
    callback: (...args: any[]) => void;
}

class SocketIOService{
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
    private logger: Logger = new Logger('socket-io-service');

    constructor(baseUrl: string, options: SocketOptions = {}){
        this.connectionUrl = options.url || baseUrl;
        this.logger.log('Socket URL:', this.connectionUrl);

        this.options = {
            path: options.path || '/socket.io',
            autoConnect: options.autoConnect ?? true,
            reconnection: options.reconnection ?? true,
            reconnectionAttempts: options.reconnectionAttempts ?? 5,
            reconnectionDelay: options.reconnectionDelay ?? 1000,
            timeout: options.timeout ?? 20000,
            auth: options.auth || {}
        };

        this.maxReconnectionAttempts = this.options.reconnectionAttempts || 5;
        this.autoReconnect = this.options.reconnection ?? true;

        if(this.options.autoConnect){
            this.connect();
        }
    }

    public connect(): Promise<void>{
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

    public disconnect(): void{
        if(!this.socket) return;

        this.manualDisconnect = true;
        this.socket.disconnect();
        this.notifyConnectionListeners(false);
    }

    public isConnected(): boolean{
        return !!this.socket?.connected;
    }

    public on<T= any>(event: string, callback: (data: T) => void): () => void{
        if(!event || typeof callback !== 'function'){
            throw new Error('Event name and callback function are required');
        }

        const subscription: EventSubscription = { event, callback };
        this.subscriptions.push(subscription);

        if(this.socket){
            this.socket.on(event, callback);
        }

        // Unsubscribe function
        return () => {
            this.off(event, callback);
        };
    }

    public off(event: string, callback?: (...args: any[]) => void): void{
        if(!event) return;

        // Remove from our subscription list
        if(callback){
            this.subscriptions = this.subscriptions.filter((sub) => sub.event !== event || sub.callback !== callback);
        }else{
            this.subscriptions = this.subscriptions.filter((sub) => sub.event !== event);
        }

        // Remove from socket in connected
        if(this.socket){
            if(callback){
                this.socket.off(event, callback);
            }else{
                this.socket.off(event);
            }
        }
    }

    public emit<T = any>(event: string, data?: any): Promise<T>{
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
                this.logger.error(`Error emitting ${event}:`, error);
                reject(error);
            }
        });
    }

    public subscribeToTrajectory(trajectoryId: string, user: any, previousTrajectoryId?: string){
        if(!this.socket?.connected){
            this.logger.error('Cannot subscribe to trajectory: Socket not connected');
            return Promise.reject(new Error('not connected'));
        }

        this.logger.log(`Subscribing to trajectory ${trajectoryId}`);
        return this.emit('subscribe_to_trajectory', { trajectoryId, user, previousTrajectoryId });
    }

    public onConnectionChange(listener: (connected: boolean) => void): () => void{
        this.connectionListeners.push(listener);
        return () => {
            this.connectionListeners = this.connectionListeners.filter((l) => l !== listener);
        };
    }

    public subscribeToTeam(teamId: string, previousTeamId?: string): void{
        if(!this.socket?.connected){
            this.logger.error('Cannot subscribe to team: Socket not connected');
            return;
        }

        this.logger.log(`Subscribing to team ${teamId}${previousTeamId ? ` (leaving ${previousTeamId})` : ''}`);
        this.socket.emit('subscribe_to_team', { teamId, previousTeamId });
    }



    public updateAuth(auth: Record<string, any>): void{
        this.options.auth = { ...this.options.auth, ...auth };
        
        if(this.socket?.connected){
            this.disconnect();
            this.connect().catch(this.logger.error);
        }
    }

    private handleConnect(){
        this.connectionAttempts = 0;
        this.connecting = false;
        this.notifyConnectionListeners(true);
        this.resubscribeToEvents();
        this.logger.log('Socket connected successfully with ID:', this.socket?.id);
    }

    private handleDisconnect(reason: string){
        this.logger.log('Socket disconnected:', reason);
        this.notifyConnectionListeners(false);

        // If the connection was not initiated by the client and auto-reconnect is enabled
        if(reason !== 'io client disconnect' && !this.manualDisconnect && this.autoReconnect){
            this.connect().catch(this.logger.error);
        }
    }

    private handleConnectError(error: any, reject: any = null){
        this.logger.error('Socket connection error:', error);
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

        // Clear all existing listeners first to avoid duplicates
        this.socket.removeAllListeners();

        // Add back the internal listeners
        // TODO:
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
        this.socket.on('connect_error', (err) => this.handleConnectError(err));

        // Re-add all user subscriptions
        this.subscriptions.forEach((sub) => {
            if(this.socket){
                this.socket.on(sub.event, sub.callback);
            }
        });
    }

    private notifyConnectionListeners(connected: boolean): void{
        this.connectionListeners.forEach((listener) => {
            try{
                listener(connected);
            }catch(error){
                this.logger.error('Error in connection listener:', error);
            }
        });
    }
}

export const socketService = new SocketIOService(import.meta.env.VITE_API_URL);

export default SocketIOService;