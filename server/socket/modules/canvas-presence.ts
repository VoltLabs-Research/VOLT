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

import { Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';

interface PresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

class CanvasPresenceModule extends BaseSocketModule {
    constructor() {
        super('CanvasPresenceModule');
    }

    onConnection(socket: Socket): void {
        // Subscribe to trajectory canvas view (for actual viewers)
        this.wirePresenceSubscription(socket, {
            event: 'subscribe_to_canvas',
            roomOf: (payload: { trajectoryId?: string }) => {
                const room = payload.trajectoryId ? `canvas:${payload.trajectoryId}` : undefined;
                console.log(`[${this.name}] Canvas room determined: ${room} for trajectory: ${payload.trajectoryId}`);
                return room;
            },
            previousOf: (payload: { trajectoryId?: string; previousTrajectoryId?: string }) => 
                payload.previousTrajectoryId ? `canvas:${payload.previousTrajectoryId}` : undefined,
            setContext: (socket, payload: { trajectoryId?: string; user?: any }) => {
                socket.data.trajectoryId = payload.trajectoryId;
                socket.data.user = payload.user;
                socket.data.viewType = 'canvas';
                console.log(`[${this.name}] Context set for socket ${socket.id}: trajectoryId=${payload.trajectoryId}, user=${socket.data.user?.firstName || 'anonymous'}`);
            },
            updateEvent: 'canvas_users_update',
            userFromSocket: (socket) => {
                const user = this.extractPresenceUser(socket);
                console.log(`[${this.name}] Extracted presence user from socket ${socket.id}:`, user);
                return user;
            }
        });

        // Handle explicit canvas unsubscribe
        socket.on('unsubscribe_from_canvas', async (payload: { trajectoryId?: string }) => {
            if (!payload.trajectoryId) return;

            const canvasRoom = `canvas:${payload.trajectoryId}`;
            console.log(`[${this.name}] Socket ${socket.id} unsubscribing from canvas: ${canvasRoom}`);
            
            this.leaveRoom(socket, canvasRoom);
            
            // Clear context
            socket.data.trajectoryId = undefined;
            socket.data.viewType = undefined;

            // Broadcast updated presence
            await this.broadcastPresence(canvasRoom, 'canvas_users_update', (s) => this.extractPresenceUser(s));
        });

        // Observer subscription (for dashboard cards - doesn't join main room)
        socket.on('observe_canvas_presence', async (payload: { trajectoryId?: string }) => {
            if (!payload.trajectoryId) return;

            const observerRoom = `canvas-observer:${payload.trajectoryId}`;
            const mainRoom = `canvas:${payload.trajectoryId}`;
            
            // Join observer room (separate from main canvas room)
            this.joinRoom(socket, observerRoom);
            socket.data.observing = payload.trajectoryId;
            socket.data.observerType = 'canvas';

            console.log(`[${this.name}] Socket ${socket.id} observing canvas presence for ${payload.trajectoryId}`);

            // Immediately send current canvas users to this observer with trajectory-specific event
            const users = await this.collectPresence(mainRoom, (s) => this.extractPresenceUser(s));
            socket.emit(`canvas_users_update:${payload.trajectoryId}`, users);
        });

        // Subscribe to raster view (for actual viewers)
        this.wirePresenceSubscription(socket, {
            event: 'subscribe_to_raster',
            roomOf: (payload: { trajectoryId?: string; rasterId?: string }) => 
                payload.rasterId ? `raster:${payload.rasterId}` : payload.trajectoryId ? `raster:${payload.trajectoryId}` : undefined,
            previousOf: (payload: { rasterId?: string; previousRasterId?: string; trajectoryId?: string; previousTrajectoryId?: string }) => {
                if (payload.previousRasterId) return `raster:${payload.previousRasterId}`;
                if (payload.previousTrajectoryId) return `raster:${payload.previousTrajectoryId}`;
                return undefined;
            },
            setContext: (socket, payload: { trajectoryId?: string; rasterId?: string; user?: any }) => {
                socket.data.trajectoryId = payload.trajectoryId;
                socket.data.rasterId = payload.rasterId;
                socket.data.user = payload.user;
                socket.data.viewType = 'raster';
            },
            updateEvent: 'raster_users_update',
            userFromSocket: (socket) => this.extractPresenceUser(socket)
        });

        // Handle explicit raster unsubscribe
        socket.on('unsubscribe_from_raster', async (payload: { trajectoryId?: string; rasterId?: string }) => {
            const rasterRoom = payload.rasterId 
                ? `raster:${payload.rasterId}` 
                : payload.trajectoryId ? `raster:${payload.trajectoryId}` : null;

            if (!rasterRoom) return;

            console.log(`[${this.name}] Socket ${socket.id} unsubscribing from raster: ${rasterRoom}`);
            
            this.leaveRoom(socket, rasterRoom);
            
            // Clear context
            socket.data.trajectoryId = undefined;
            socket.data.rasterId = undefined;
            socket.data.viewType = undefined;

            // Broadcast updated presence
            await this.broadcastPresence(rasterRoom, 'raster_users_update', (s) => this.extractPresenceUser(s));
        });

        // Observer subscription for raster (for dashboard cards)
        socket.on('observe_raster_presence', async (payload: { trajectoryId?: string }) => {
            if (!payload.trajectoryId) return;

            const observerRoom = `raster-observer:${payload.trajectoryId}`;
            const mainRoom = `raster:${payload.trajectoryId}`;
            
            // Join observer room (separate from main raster room)
            this.joinRoom(socket, observerRoom);
            socket.data.observingRaster = payload.trajectoryId;
            socket.data.observerType = 'raster';

            console.log(`[${this.name}] Socket ${socket.id} observing raster presence for ${payload.trajectoryId}`);

            // Immediately send current raster users to this observer with trajectory-specific event
            const users = await this.collectPresence(mainRoom, (s) => this.extractPresenceUser(s));
            socket.emit(`raster_users_update:${payload.trajectoryId}`, users);
        });

        // Handle disconnect for both canvas and raster
        socket.on('disconnect', async () => {
            // Broadcast presence update for canvas room if socket was in canvas
            if (socket.data?.trajectoryId && socket.data?.viewType === 'canvas') {
                const canvasRoom = `canvas:${socket.data.trajectoryId}`;
                const observerRoom = `canvas-observer:${socket.data.trajectoryId}`;
                
                // Broadcast to main room
                await this.broadcastPresence(canvasRoom, 'canvas_users_update', (s) => this.extractPresenceUser(s));
                
                // Also broadcast to observers
                if (this.io) {
                    const users = await this.collectPresence(canvasRoom, (s) => this.extractPresenceUser(s));
                    this.io.to(observerRoom).emit('canvas_users_update', users);
                }
            }

            // Broadcast presence update for raster room if socket was in raster
            if (socket.data?.viewType === 'raster') {
                const rasterRoom = socket.data?.rasterId 
                    ? `raster:${socket.data.rasterId}` 
                    : socket.data?.trajectoryId ? `raster:${socket.data.trajectoryId}` 
                    : null;
                
                if (rasterRoom) {
                    const observerRoom = socket.data?.rasterId
                        ? `raster-observer:${socket.data.rasterId}`
                        : `raster-observer:${socket.data.trajectoryId}`;
                    
                    // Broadcast to main room
                    await this.broadcastPresence(rasterRoom, 'raster_users_update', (s) => this.extractPresenceUser(s));
                    
                    // Also broadcast to observers
                    if (this.io) {
                        const users = await this.collectPresence(rasterRoom, (s) => this.extractPresenceUser(s));
                        this.io.to(observerRoom).emit('raster_users_update', users);
                    }
                }
            }
        });
    }

    /**
     * Extract presence user data from socket, handling both authenticated and anonymous users
     */
    private extractPresenceUser(socket: Socket): PresenceUser {
        const user = (socket as any).user;
        const isAnonymous = !user || !user._id;

        return {
            id: user?._id?.toString() || socket.id,
            email: user?.email,
            firstName: user?.firstName,
            lastName: user?.lastName,
            isAnonymous
        };
    }
}

export default CanvasPresenceModule;
