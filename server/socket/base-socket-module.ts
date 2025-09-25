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

import { Server, Socket } from 'socket.io';

/**
 * Base class for SocketIO feature modules.
 * Each module can hook into the lifecycle and register its own handlers.
 */
abstract class BaseSocketModule{
    /**
     * Optional name used for logging/metrics.
     */
    public readonly name: string;

    constructor(name: string){
        this.name = name;
    }

    /**
     * Called once when the module is registered in the gateway.
     * Use this to register global handlers or namespaces.
     * 
     * @param io The initialized SocketIO server.
     */
    onInit(io: Server): void{}

    /**
     * Called per connection if the module wants to handle the socket.
     * Gateway will call this for every module on each new connection.
     * 
     * @param socket Connected socket.
     */
    onConnection(socket: Socket): void{}

    /**
     * Called during graceful shutdown.
     * Clean up timers, external subscriptions, etc.
     */
    async onShutdown(): Promise<void>{}

    /**
     * Join a room!
     */
    protected joinRoom(socket: Socket, room: string): void{
        socket.join(room);
        console.log(`[${this.name}] Socket ${socket.id} joined room: ${room}`);
    }

    /**
     * Leave room!
     */
    protected leaveRoom(socket: Socket, room: string): void{
        socket.leave(room);
        console.log(`[${this.name}] Socket ${socket.id} left room: ${room}`);
    }
}

export default BaseSocketModule;