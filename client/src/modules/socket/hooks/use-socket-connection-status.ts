import socketService from '@/modules/socket/services/socket-service';
import { useSyncExternalStore } from 'react';
import type { SocketConnectionStatus } from '@/modules/socket/socket-connection-status';

const useSocketConnectionStatus = (): SocketConnectionStatus => {
    return useSyncExternalStore(
        (listener) => socketService.onConnectionStatusChange(() => listener()),
        () => socketService.getConnectionStatus(),
        () => socketService.getConnectionStatus()
    );
};

export default useSocketConnectionStatus;
