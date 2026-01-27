import { useState, useEffect } from 'react';
import { getRasterUseCases } from '@/modules/raster/application/registry';
import { type User } from '@/types/models';

const useRasterConnectedUsers = (trajectoryId?: string) => {
    const { rasterPresenceSocketUseCase } = getRasterUseCases();
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [isConnected, setIsConnected] = useState(() => rasterPresenceSocketUseCase.isConnected());

    // Monitor connection status
    useEffect(() => {
        setIsConnected(rasterPresenceSocketUseCase.isConnected());

        const unsubscribe = rasterPresenceSocketUseCase.onConnectionChange((connected) => {
            console.log(`[useRasterConnectedUsers] Connection status changed: ${connected}`);
            setIsConnected(connected);
        });

        return unsubscribe;
    }, [rasterPresenceSocketUseCase]);

    useEffect(() => {
        if (!trajectoryId || !isConnected) {
            console.log(`[useRasterConnectedUsers] Skipping subscription - trajectoryId: ${trajectoryId}, isConnected: ${isConnected}`);
            return;
        }

        console.log(`[useRasterConnectedUsers] Subscribing to raster for trajectory: ${trajectoryId}`);

        // Subscribe to raster presence(main room, not observer)
        rasterPresenceSocketUseCase.subscribeToRaster({ trajectoryId }).then(() => {
            console.log(`[useRasterConnectedUsers] Successfully subscribed to raster: ${trajectoryId}`);
        }).catch((error) => {
            console.error('[useRasterConnectedUsers] Failed to subscribe to raster:', error);
        });

        const handleUsersUpdate = (users: User[]) => {
            console.log(`[useRasterConnectedUsers] Received raster_users_update for ${trajectoryId}:`, users);
            setConnectedUsers(users);
        };

        const unsubscribe = rasterPresenceSocketUseCase.onRasterUsersUpdate(handleUsersUpdate);

        return () => {
            console.log(`[useRasterConnectedUsers] Cleanup: Unsubscribing from raster: ${trajectoryId}`);
            unsubscribe();

            // Emit unsubscribe event to backend
            rasterPresenceSocketUseCase.unsubscribeFromRaster({ trajectoryId }).then(() => {
                console.log(`[useRasterConnectedUsers] Successfully unsubscribed from raster: ${trajectoryId}`);
            }).catch((error) => {
                console.error('[useRasterConnectedUsers] Failed to unsubscribe from raster:', error);
            });
        };
    }, [trajectoryId, isConnected, rasterPresenceSocketUseCase]);

    return connectedUsers;
};

export default useRasterConnectedUsers;
