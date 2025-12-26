import { useState, useEffect } from 'react';
import { socketService } from '@/services/socketio';
import { type User } from '@/types/models';

const useRasterConnectedUsers = (trajectoryId?: string) => {
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());

    // Monitor connection status
    useEffect(() => {
        setIsConnected(socketService.isConnected());

        const unsubscribe = socketService.onConnectionChange((connected) => {
            console.log(`[useRasterConnectedUsers] Connection status changed: ${connected}`);
            setIsConnected(connected);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!trajectoryId || !isConnected) {
            console.log(`[useRasterConnectedUsers] Skipping subscription - trajectoryId: ${trajectoryId}, isConnected: ${isConnected}`);
            return;
        }

        console.log(`[useRasterConnectedUsers] Subscribing to raster for trajectory: ${trajectoryId}`);

        // Subscribe to raster presence(main room, not observer)
        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).then(() => {
            console.log(`[useRasterConnectedUsers] Successfully subscribed to raster: ${trajectoryId}`);
        }).catch((error) => {
            console.error('[useRasterConnectedUsers] Failed to subscribe to raster:', error);
        });

        const handleUsersUpdate = (users: User[]) => {
            console.log(`[useRasterConnectedUsers] Received raster_users_update for ${trajectoryId}:`, users);
            setConnectedUsers(users);
        };

        const unsubscribe = socketService.on('raster_users_update', handleUsersUpdate);

        return () => {
            console.log(`[useRasterConnectedUsers] Cleanup: Unsubscribing from raster: ${trajectoryId}`);
            unsubscribe();

            // Emit unsubscribe event to backend
            socketService.emit('unsubscribe_from_raster', {
                trajectoryId
            }).then(() => {
                console.log(`[useRasterConnectedUsers] Successfully unsubscribed from raster: ${trajectoryId}`);
            }).catch((error) => {
                console.error('[useRasterConnectedUsers] Failed to unsubscribe from raster:', error);
            });
        };
    }, [trajectoryId, isConnected]);

    return connectedUsers;
};

export default useRasterConnectedUsers;
