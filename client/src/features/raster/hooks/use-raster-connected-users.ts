import { useState, useEffect } from 'react';
import { socketService } from '@/services/websockets/socketio';
import { type User } from '@/types/models';

const useRasterConnectedUsers = (trajectoryId?: string) => {
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());

    // Monitor connection status
    useEffect(() => {
        setIsConnected(socketService.isConnected());

        const unsubscribe = socketService.onConnectionChange((connected) => {
            setIsConnected(connected);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!trajectoryId || !isConnected) {
            return;
        }

        // Subscribe to raster presence(main room, not observer)
        socketService.emit('subscribe_to_raster', {
            trajectoryId
        }).then(() => {
            console.log(`[useRasterConnectedUsers] Successfully subscribed to raster: ${trajectoryId}`);
        }).catch((error) => {
            console.error('[useRasterConnectedUsers] Failed to subscribe to raster:', error);
        });

        const handleUsersUpdate = (users: User[]) => {
            setConnectedUsers(users);
        };

        const unsubscribe = socketService.on('raster_users_update', handleUsersUpdate);

        return () => {
            unsubscribe();

            // Emit unsubscribe event to backend
            socketService.emit('unsubscribe_from_raster', {
                trajectoryId
            }).then(() => {
            }).catch((error) => {
                console.error('[useRasterConnectedUsers] Failed to unsubscribe from raster:', error);
            });
        };
    }, [trajectoryId, isConnected]);

    return connectedUsers;
};

export default useRasterConnectedUsers;
