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
    velocity?: number;
    angle?: number;
};

type UseCursorShareOptions = {
    user?: CursorUser;
    minIntervalMs?: number;
    toRoomCoords?: (clientX: number, clientY: number) => { x: number; y: number };
    throttleMovement?: boolean;
    enablePrediction?: boolean;
};

interface CursorState {
    x: number;
    y: number;
    velocity: number;
    angle: number;
    lastUpdate: number;
}

const useCursorShare = (roomName?: string, opts: UseCursorShareOptions = {}) => {
    const { 
        user, 
        minIntervalMs = 33,
        toRoomCoords,
        throttleMovement = true,
        enablePrediction = true
    } = opts;

    // Use refs to avoid re-renders for frequently changing data
    const remoteRef = useRef<Record<string, RemoteCursor>>({});
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    
    // Movement tracking
    const lastSentRef = useRef(0);
    const pendingMoveRef = useRef<CursorState | null>(null);
    const sendTimeoutRef = useRef<number | null>(null);
    
    // Connection state
    const joinedRef = useRef(false);
    const lastJoinKeyRef = useRef<string>('');  
    const isActiveRef = useRef(true);

    // Throttled state update to prevent excessive re-renders
    const updateRemoteCursorsThrottled = useCallback(() => {
        const cursors = Object.values(remoteRef.current);
        setRemoteCursors(cursors);
    }, []);

    // Debounced state update
    const updateStateTimeoutRef = useRef<number | null>(null);
    const scheduleStateUpdate = useCallback(() => {
        if (updateStateTimeoutRef.current) return;
        
        updateStateTimeoutRef.current = setTimeout(() => {
            updateRemoteCursorsThrottled();
            updateStateTimeoutRef.current = null;
            //  ~60fps max for state updates
        }, 16);
    }, [updateRemoteCursorsThrottled]);

    const join = useCallback(() => {
        if (!roomName || !socketService.isConnected()) return;
        const userId = (user as any)?.id || (user as any)?.email || 'anon';
        const key = `${roomName}:${userId}`;
        if (lastJoinKeyRef.current === key && joinedRef.current) return;
        
        lastJoinKeyRef.current = key;
        joinedRef.current = true;
        
        socketService.emit('cursor:join', { room: roomName, user }).catch(() => {
            joinedRef.current = false;
        });
    }, [roomName, user]);

    useEffect(() => {
        if (!roomName) return;
        
        const offConn = socketService.onConnectionChange((connected) => {
            if (connected) {
                join();
            } else {
                joinedRef.current = false;
                // Clear cursors on disconnect
                remoteRef.current = {};
                setRemoteCursors([]);
            }
        });
        
        return () => {
            offConn();
            joinedRef.current = false;
            isActiveRef.current = false;
        };
    }, [roomName, join]);

    useEffect(() => {
        if (!roomName || !socketService.isConnected() || !user) return;
        
        joinedRef.current = false;
        join();
    }, [roomName, (user as any)?.id, join]);

    useEffect(() => {
        const offMove = socketService.on('cursor:move', (payload: RemoteCursor) => {
            if (!isActiveRef.current) return;
            
            if (remoteRef.current[payload.id] && !payload.velocity) {
                const prev = remoteRef.current[payload.id];
                const dx = payload.x - prev.x;
                const dy = payload.y - prev.y;
                const dt = Math.max(1, payload.ts - prev.ts);
                payload.velocity = Math.sqrt(dx * dx + dy * dy) / (dt / 1000);
                payload.angle = Math.atan2(dy, dx);
            }
            
            remoteRef.current[payload.id] = payload;
            scheduleStateUpdate();
        });

        const offJoined = socketService.on('cursor:user-joined', (payload: { id: string; user?: CursorUser }) => {
            if (!isActiveRef.current) return;
            
            const existing = remoteRef.current[payload.id];
            remoteRef.current[payload.id] = existing
                ? { ...existing, user: payload.user }
                : { id: payload.id, x: 0, y: 0, ts: Date.now(), user: payload.user };
            
            scheduleStateUpdate();
        });

        const offLeft = socketService.on('cursor:user-left', (payload: { id: string }) => {
            if (!isActiveRef.current) return;
            
            delete remoteRef.current[payload.id];
            scheduleStateUpdate();
        });

        return () => {
            offMove();
            offJoined();
            offLeft();
            
            // Cleanup timeouts
            if (updateStateTimeoutRef.current) {
                clearTimeout(updateStateTimeoutRef.current);
            }
            if (sendTimeoutRef.current) {
                clearTimeout(sendTimeoutRef.current);
            }
        };
    }, [scheduleStateUpdate]);

    // Optimized movement handling with intelligent throttling
    const sendCursorData = useCallback((force: boolean = false) => {
        const pending = pendingMoveRef.current;
        if (!pending || !roomName || !socketService.isConnected()) return;

        const now = performance.now();
        const timeSinceLastSent = now - lastSentRef.current;
        const shouldSend = force || 
                          !throttleMovement || 
                          timeSinceLastSent >= minIntervalMs ||
                          pending.velocity > 150;

        if (shouldSend) {
            const payload = {
                room: roomName,
                x: Math.round(pending.x * 100) / 100,
                y: Math.round(pending.y * 100) / 100,
                ts: now,
                velocity: Math.round(pending.velocity),
                angle: pending.angle
            };
            
            socketService.emit('cursor:move', payload).catch(() => {});
            lastSentRef.current = now;
            pendingMoveRef.current = null;
            
            // Clear any pending timeout
            if (sendTimeoutRef.current) {
                clearTimeout(sendTimeoutRef.current);
                sendTimeoutRef.current = null;
            }
        } else if (!sendTimeoutRef.current) {
            // Schedule for later sending
            const delay = Math.max(minIntervalMs - timeSinceLastSent, 10);
            sendTimeoutRef.current = setTimeout(() => {
                sendCursorData(true);
                sendTimeoutRef.current = null;
            }, delay);
        }
    }, [roomName, minIntervalMs, throttleMovement]);

    const handleMouseMove = useCallback(
        (e: MouseEvent | React.MouseEvent) => {
            if (!isActiveRef.current) return;
            
            const clientX = 'clientX' in e ? e.clientX : 0;
            const clientY = 'clientY' in e ? e.clientY : 0;
            const { x, y } = toRoomCoords ? toRoomCoords(clientX, clientY) : { x: clientX, y: clientY };
            
            const now = performance.now();
            const current = pendingMoveRef.current;
            
            let velocity = 0;
            let angle = 0;
            
            if (current) {
                const dt = Math.max(1, now - current.lastUpdate);
                const dx = x - current.x;
                const dy = y - current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                velocity = distance / (dt / 1000);
                angle = Math.atan2(dy, dx);
                
                // Smooth velocity to reduce jitter
                velocity = velocity * 0.3 + current.velocity * 0.7;
            }
            
            pendingMoveRef.current = {
                x,
                y,
                velocity,
                angle,
                lastUpdate: now
            };
            
            // Send immediately for first movement or use throttling
            sendCursorData(current === null);
        },
        [toRoomCoords, sendCursorData]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            if (updateStateTimeoutRef.current) {
                clearTimeout(updateStateTimeoutRef.current);
            }
            if (sendTimeoutRef.current) {
                clearTimeout(sendTimeoutRef.current);
            }
        };
    }, []);

    return {
        remoteCursors,
        remoteById: remoteRef.current,
        handleMouseMove,
        getCursorVelocity: (id: string) => remoteRef.current[id]?.velocity || 0,
        isPredictionEnabled: enablePrediction,
        getActiveUserCount: () => remoteCursors.length,
        isThrottling: sendTimeoutRef.current !== null
    };
};

export default useCursorShare;  