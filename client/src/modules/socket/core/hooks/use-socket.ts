import socketService from '../services/socket-service';
import { useMemo } from 'react';
import type { ISocketService } from '../services/contracts/socket-service';

const useSocket = (): ISocketService => {
    return useMemo(() => socketService, []);
};

export default useSocket;
