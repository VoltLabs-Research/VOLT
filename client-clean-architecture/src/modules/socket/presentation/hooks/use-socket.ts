import { useMemo } from 'react';
import { container } from 'tsyringe';
import ISocketService from '../../domain/ports/ISocketService';
import { SOCKET_TOKENS } from '../../infrastructure/di/tokens';

const useSocket = (): ISocketService => {
    const socketService = useMemo(() => {
        return container.resolve<ISocketService>(SOCKET_TOKENS.SocketService);
    }, []);

    return socketService;
};

export default useSocket;
