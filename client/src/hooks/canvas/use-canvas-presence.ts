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

import { useEffect, useState } from 'react';
import { socketService } from '@/services/socketio';

export interface CanvasPresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

interface UseCanvasPresenceProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useCanvasPresence = ({ trajectoryId, enabled = true }: UseCanvasPresenceProps) => {
    const [canvasUsers, setCanvasUsers] = useState<CanvasPresenceUser[]>([]);
    const [rasterUsers, setRasterUsers] = useState<CanvasPresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());

    console.log(`[use-canvas-presence] Hook initialized - trajectoryId: ${trajectoryId}, isConnected: ${isConnected}, enabled: ${enabled}`);

    // Monitor connection status
    useEffect(() => {
        // Set initial state
        setIsConnected(socketService.isConnected());
        
        const unsubscribe = socketService.onConnectionChange((connected) => {
            console.log(`[use-canvas-presence] Connection status changed: ${connected}`);
            setIsConnected(connected);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!enabled || !trajectoryId || !isConnected) {
            console.log(`[use-canvas-presence] Skipping canvas subscription - enabled: ${enabled}, trajectoryId: ${trajectoryId}, isConnected: ${isConnected}`);
            return;
        }

        console.log(`[use-canvas-presence] Subscribing to canvas for trajectory: ${trajectoryId}`);

        // Subscribe to canvas presence with previousTrajectoryId for proper cleanup
        socketService.emit('subscribe_to_canvas', {
            trajectoryId,
            previousTrajectoryId: undefined // This will be handled by socket.data on backend
        }).then(() => {
            console.log(`[use-canvas-presence] Successfully subscribed to canvas: ${trajectoryId}`);
        }).catch((error) => {
            console.error('[use-canvas-presence] Failed to subscribe to canvas:', error);
        });

        // Listen for canvas users updates
        const unsubscribeCanvas = socketService.on('canvas_users_update', (users: CanvasPresenceUser[]) => {
            console.log(`[use-canvas-presence] Received canvas_users_update for ${trajectoryId}:`, users);
            setCanvasUsers(users);
        });

        return () => {
            console.log(`[use-canvas-presence] Cleanup: Unsubscribing from canvas: ${trajectoryId}`);
            unsubscribeCanvas();
            
            // Emit unsubscribe event to backend
            socketService.emit('unsubscribe_from_canvas', {
                trajectoryId
            }).then(() => {
                console.log(`[use-canvas-presence] Successfully unsubscribed from canvas: ${trajectoryId}`);
            }).catch((error) => {
                console.error('[use-canvas-presence] Failed to unsubscribe from canvas:', error);
            });
        };
    }, [trajectoryId, enabled, isConnected]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !isConnected) {
            console.log(`[use-canvas-presence] Skipping raster subscription - enabled: ${enabled}, trajectoryId: ${trajectoryId}, isConnected: ${isConnected}`);
            return;
        }

        console.log(`[use-canvas-presence] Subscribing to raster for trajectory: ${trajectoryId}`);

        // Subscribe to raster presence
        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).then(() => {
            console.log(`[use-canvas-presence] Successfully subscribed to raster: ${trajectoryId}`);
        }).catch((error) => {
            console.error('[use-canvas-presence] Failed to subscribe to raster:', error);
        });

        // Listen for raster users updates
        const unsubscribeRaster = socketService.on('raster_users_update', (users: CanvasPresenceUser[]) => {
            console.log(`[use-canvas-presence] Received raster_users_update for ${trajectoryId}:`, users);
            setRasterUsers(users);
        });

        return () => {
            console.log(`[use-canvas-presence] Cleanup: Unsubscribing from raster: ${trajectoryId}`);
            unsubscribeRaster();
            
            // Emit unsubscribe event to backend
            socketService.emit('unsubscribe_from_raster', {
                trajectoryId
            }).then(() => {
                console.log(`[use-canvas-presence] Successfully unsubscribed from raster: ${trajectoryId}`);
            }).catch((error) => {
                console.error('[use-canvas-presence] Failed to unsubscribe from raster:', error);
            });
        };
    }, [trajectoryId, enabled, isConnected]);

    return {
        canvasUsers,
        rasterUsers,
        allUsers: [...canvasUsers, ...rasterUsers]
    };
};

export default useCanvasPresence;
