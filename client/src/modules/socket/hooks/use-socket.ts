import { useMemo } from 'react';
import socketService from '../services/socket-service';
import type { ISocketService } from '../api/entities/socket-service';

const useSocket = (): ISocketService => {
    return useMemo(() => socketService, []);
};

export default useSocket;
