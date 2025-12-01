/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import logger from '@/logger';
import { Server, Socket } from 'socket.io';

/**
 * Base class for SocketIO feature modules.
 * Each module can hook into the lifecycle and register its own handlers.
 */
abstract class BaseSocketModule {
    /**
     * Optional name used for logging/metrics.
     */
    public readonly name: string;

    /**
     * SocketIO server injected via {@link onInit}
     */
    protected io?: Server;

    constructor(name: string) {
        this.name = name;
    }

    /**
     * Called once when the module is registered in the gateway.
     * Use this to register global handlers or namespaces.
     * 
     * @param io The initialized SocketIO server.
     */
    onInit(io: Server): void {
        this.io = io;
    }

    /**
     * Called per connection if the module wants to handle the socket.
     * Gateway will call this for every module on each new connection.
     * 
     * @param socket Connected socket.
     */
    onConnection(socket: Socket): void { }

    /**
     * Called during graceful shutdown.
     * Clean up timers, external subscriptions, etc.
     */
    async onShutdown(): Promise<void> { }

    /**
     * Join a room!
     */
    protected joinRoom(socket: Socket, room: string): void {
        // Check if socket is already in the room to prevent duplicate joins
        if (socket.rooms.has(room)) {
            return;
        }
        socket.join(room);
        logger.info(`[${this.name}] Socket ${socket.id} joined room: ${room}`);
    }

    /**
     * Leave room!
     */
    protected leaveRoom(socket: Socket, room: string): void {
        socket.leave(room);
        logger.info(`[${this.name}] Socket ${socket.id} left room: ${room}`);
    }

    /**
     * Wires a **subscription pattern with presence** for a specific event.
     * 
     * 1. If a previous room is provided in the payload, the socket leaves it and presence snapshot is broadcast.
     * 2. The socket joins the new room.
     * 3. Provided context is persisted in `socket.data` (e.g., ids and user object).
     * 4. A fresh presence snapshopt is broadcast to the new room via `updateEvent`.
     * 
     * @typeParam TPayload - Shape of the incoming event payload.
     * @param socket The socket to wire.
     * @param cfg Configuration object:
     * @param cfg.event Event name to listen to (e.g. `"subscribe_to_trajectory"`).
     * @param cfg.roomOf Extracts the **current** room name from the payload.
     * @param cfg.previousOf Extracts the **previous** room name from the payload (optional).
     * @param cfg.setContext Persists any needed context into `socket.data`.
     * @param cfg.updateEvent The event name used to broadcast the presence list (e.g.  `"trajectory_users_update"`).
     * @param cfg.userFromSocket Optional mapper to extract a presence from a socket; defaults to `socket.data.user`.
     */
    protected wirePresenceSubscription<TPayload extends Record<string, any>>(
        socket: Socket,
        cfg: {
            event: string;
            roomOf: (payload: TPayload) => string | undefined;
            previousOf: (payload: TPayload) => string | undefined;
            setContext: (socket: Socket, payload: TPayload) => void;
            updateEvent: string;
            userFromSocket?: (socket: Socket) => any
        }
    ) {
        socket.on(cfg.event, async (payload: TPayload) => {
            const prev = cfg.previousOf?.(payload);
            if (prev) {
                this.leaveRoom(socket, prev);
                await this.broadcastPresence(prev, cfg.updateEvent, cfg.userFromSocket);
            }

            const room = cfg.roomOf(payload);
            if (!room) return;

            cfg.setContext(socket, payload);
            this.joinRoom(socket, room);

            await this.broadcastPresence(room, cfg.updateEvent, cfg.userFromSocket);
        });
    }

    /**
     * Registers a **disconnect handler** that re-broadcasts presence for the room
     * associated with the socket.
     * 
     * @param socket The socket to wire.
     * @param getRoomFromSocket Getter that returns the room to refresh (e.g., `(socket) => socket.data.trajectoryId`).
     * @param updateEvent Event name to broadcast the updated presence list on.
     * @param userFromSocket Optional mapper to extract a {@link PresenceUser} from a socket; defaults to `socket.data.user`.
     */
    protected wirePresenceOnDisconnect(
        socket: Socket,
        getRoomFromSocket: (socket: Socket) => string | undefined,
        updateEvent: string,
        userFromSocket?: (socket: Socket) => any
    ) {
        socket.on('disconnect', async () => {
            const room = getRoomFromSocket(socket);
            if (room) {
                await this.broadcastPresence(room, updateEvent, userFromSocket);
            }
        });
    }

    /**
     * Broadcasts the **deduplicated** list of connected users for a room.
     * Uses the Redis adapter under de hood (if configured) so it works across nodes.
     * 
     * @param room Room name to inspect.
     * @param updateEvent Event name to emit with the users payload.
     * @param userFromSocket Optional mapper to extract; defaults to `socket.data.user`.
     */
    protected async broadcastPresence(
        room: string,
        updateEvent: string,
        userFromSocket?: (socket: Socket) => any
    ) {
        if (!this.io) {
            return;
        }

        const users = await this.collectPresence(room, userFromSocket);
        logger.info(`[${this.name}] Broadcasting presence to room ${room} with event ${updateEvent}: ${users.length} users - ${JSON.stringify(users)}`);
        this.io.to(room).emit(updateEvent, users);

        // Also broadcast to observer rooms with trajectory-specific event
        const observerRoom = room.replace(/^(canvas|raster):/, '$1-observer:');
        if (observerRoom !== room) {
            // Extract trajectoryId from room name (e.g., "canvas:123" -> "123")
            const trajectoryId = room.split(':')[1];
            const trajectorySpecificEvent = `${updateEvent}:${trajectoryId}`;
            logger.info(`[${this.name}] Also broadcasting to observer room: ${observerRoom} with event ${trajectorySpecificEvent}`);
            this.io.to(observerRoom).emit(trajectorySpecificEvent, users);
        }
    }

    /**
     * Collects the presence list for a room by querying sockets in that room
     * (cluster-wide when using the Redis adapter) and **deduplicates** by `id`
     * (fallin back to `socket.id` when missing).
     * 
     * @param room Room name to inspect.
     * @param userFromSocket Optional mapper to extract; defaults to `socket.data.user`.
     * @returns The list of connected users for a room.
     */
    protected async collectPresence(
        room: string,
        userFromSocket?: (socket: Socket) => any
    ): Promise<any[]> {
        if (!this.io) return [];

        try {
            const sockets = await this.io.in(room).fetchSockets();
            const byId = new Map<string, any>();

            for (const socket of sockets) {
                // Use custom extractor if provided, otherwise fall back to default
                const presenceUser = userFromSocket
                    ? userFromSocket(socket)
                    : (() => {
                        const user: any = (socket as any).user;
                        const isAnonymous = !user || !user._id;
                        return {
                            id: user?._id?.toString() || socket.id,
                            email: user?.email,
                            firstName: user?.firstName,
                            lastName: user?.lastName,
                            isAnonymous
                        };
                    })();

                const uid = presenceUser.id || socket.id;
                if (!uid) continue;

                if (!byId.has(uid)) {
                    byId.set(uid, presenceUser);
                }
            }

            return Array.from(byId.values());
        } catch (error) {
            logger.error(`[${this.name}] Error fetching sockets for room ${room}: ${error}`);
            return [];
        }
    }
}

export default BaseSocketModule;
