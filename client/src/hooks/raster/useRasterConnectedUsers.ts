import { useState, useEffect } from 'react';
import { socketService } from '@/services/socketio';
import { type User } from '@/types/models';

 const useRasterConnectedUsers = (trajectoryId?: string) => {
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        const handleUsersUpdate = (users: User[]) => {
            setConnectedUsers(users);
        };

        const unsubscribe = socketService.on('trajectory_users_update', handleUsersUpdate);

        return () => {
            unsubscribe();
        };
    }, [trajectoryId]);

    return connectedUsers;
};

export default useRasterConnectedUsers;