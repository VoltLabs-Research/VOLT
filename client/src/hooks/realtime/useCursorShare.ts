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

import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '@/services/socketio';

export type CursorUser = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    color?: string;
};

export type RemoteCursor = {
    id: string;
    x: number;
    y: number;
    ts: number;
    user?: CursorUser;
};

type UseCursorShareOptions = {
    user?: CursorUser;
    minIntervalMs?: number;
    toRoomCoords?: (clientX: number, clientY: number) => { x: number, y: number };
};

/**
 * Shares the local cursor into a room and maintains remote cursors in state.
 * Emits on rAF for smoothness; server just fans out to room.
 */
const useCursorShare = (roomName?: string, opts: UseCursorShareOptions = {}) => {
    const { user, minIntervalMs = 0, toRoomCoords } = opts;
    const [remote, setRemote] = useState<Record<string, RemoteCursor>>({});
    const lastSentRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const pendingPosRef = useRef<{ x: number; y: number } | null>(null);
    const joinedRef = useRef(false);

    // Join room (and rejoin on reconnect)
    const join = useCallback(() => {
        if(!roomName || !socketService.isConnected()) return;
        socketService.emit('cursor:join', { room: roomName, user }).catch(() => {});
        joinedRef.current = true;
    }, [roomName, user]);

    useEffect(() => {
        if(!roomName) return;

        // initial connect, if already connected, join immediately
        if(socketService.isConnected()) join();

        // rejoin on connection changes
        const offConn = socketService.onConnectionChange((connected) => {
            if(connected) join();
        });

        return () => {
            offConn();

            if(joinedRef.current && socketService.isConnected()){
                socketService.emit('cursor:leave', { room: roomName }).catch(() => {});
            }

            joinedRef.current = false;
        };
    }, [roomName, join]);

    // Listen server events
    useEffect(() => {
        const offMove = socketService.on('cursor:move', (payload: RemoteCursor) => {
            setRemote((prev) => ({ ...prev, [payload.id]: payload }));
        });

        const offJoined = socketService.on('cursor:user-joined', (payload: { id: string, user?: CursorUser }) => {
            setRemote((prev) => {
                // if we already have a position for this id, preserve pos; just attach user
                const curr = prev[payload.id];
                return {
                    ...prev,
                    [payload.id]: curr ? { ...curr, user: payload.user } : { id: payload.id, x: 0, y: 0, ts: Date.now(), user: payload.user }
                };
            });
        });

        const offLeft = socketService.on('cursor:user-left', (payload: { id: string }) => {
            setRemote((prev) => {
                const { [payload.id]: _, ...rest } = prev;
                return rest;
            });
        });

        return () => {
            offMove();
            offJoined();
            offLeft();
        };
    }, []);

    // rAF loop to emit pending cursor position (smooth & rate-limited)
    useEffect(() => {
        const tick = (now: number) => {
            const pending = pendingPosRef.current;
            if(pending && roomName && socketService.isConnected()){
                if(!minIntervalMs || now - lastSentRef.current >= minIntervalMs){
                    socketService
                        .emit('cursor:move', {
                            room: roomName,
                            x: pending.x,
                            y: pending.y,
                            ts: now
                        })
                        .catch(() => {});
                    lastSentRef.current = now;
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if(rafRef.current !== null){
                cancelAnimationFrame(rafRef.current);
            }

            rafRef.current = null;
        };
    }, [roomName, minIntervalMs]);

    // called from onMouseMove in container or attached it
    // to window for full-viewport tracking.
    const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
        const clientX = 'clientX' in e ? e.clientX : 0;
        const clientY = 'clientY' in e ? e.clientY : 0;

        const { x, y } = toRoomCoords ? toRoomCoords(clientX, clientY) : { x: clientX, y: clientY };
        pendingPosRef.current = { x, y };
    }, [toRoomCoords]);

    return {
        remoteCursor: Object.values(remote),
        remoteByid: remote,
        handleMouseMove
    }
};

export default useCursorShare;
