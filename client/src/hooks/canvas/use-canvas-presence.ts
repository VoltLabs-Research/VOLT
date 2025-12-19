/**
 * Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { socketService } from '@/services/socketio';
import { useSyncExternalStore } from 'react';

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

const presenceState = {
    canvasUsers: [] as CanvasPresenceUser[],
    rasterUsers: [] as CanvasPresenceUser[],
    listeners: new Set<() => void>(),
};

const notifyListeners = () => {
    presenceState.listeners.forEach(l => l());
};

const setCanvasUsers = (users: CanvasPresenceUser[]) => {
    presenceState.canvasUsers = users;
    notifyListeners();
};

const setRasterUsers = (users: CanvasPresenceUser[]) => {
    presenceState.rasterUsers = users;
    notifyListeners();
};

const subscribe = (listener: () => void) => {
    presenceState.listeners.add(listener);
    return () => presenceState.listeners.delete(listener);
};

const getSnapshot = () => presenceState;

const useCanvasPresence = ({ trajectoryId, enabled = true }: UseCanvasPresenceProps) => {
    // Use refs to avoid re-renders from connection status changes
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);

    // Use sync external store for minimal re-renders
    const state = useSyncExternalStore(subscribe, getSnapshot);

    // Subscribe to socket connection changes WITHOUT causing re-renders
    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            // Only try to subscribe when connection established
            if (connected && enabled && trajectoryId && !subscribedRef.current) {
                subscribeToPresence();
            }
        });
        return unsubscribe;
    }, [enabled, trajectoryId]);

    const subscribeToPresence = useCallback(() => {
        if (!enabled || !trajectoryId || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        subscribedRef.current = true;

        // Subscribe to canvas
        socketService.emit('subscribe_to_canvas', {
            trajectoryId,
            previousTrajectoryId: undefined
        }).catch(() => { });

        // Subscribe to raster
        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).catch(() => { });
    }, [enabled, trajectoryId]);

    // Main subscription effect - runs once when conditions are met
    useEffect(() => {
        if (!enabled || !trajectoryId) {
            return;
        }

        // Try to subscribe if already connected
        if (isConnectedRef.current) {
            subscribeToPresence();
        }

        // Listen for updates
        const unsubscribeCanvas = socketService.on('canvas_users_update', setCanvasUsers);
        const unsubscribeRaster = socketService.on('raster_users_update', setRasterUsers);

        return () => {
            subscribedRef.current = false;
            unsubscribeCanvas();
            unsubscribeRaster();

            // Cleanup subscriptions
            if (isConnectedRef.current) {
                socketService.emit('unsubscribe_from_canvas', { trajectoryId }).catch(() => { });
                socketService.emit('unsubscribe_from_raster', { trajectoryId }).catch(() => { });
            }

            // Clear state
            setCanvasUsers([]);
            setRasterUsers([]);
        };
    }, [trajectoryId, enabled, subscribeToPresence]);

    return useMemo(() => ({
        canvasUsers: state.canvasUsers,
        rasterUsers: state.rasterUsers,
        allUsers: [...state.canvasUsers, ...state.rasterUsers]
    }), [state.canvasUsers, state.rasterUsers]);
};

export default useCanvasPresence;
