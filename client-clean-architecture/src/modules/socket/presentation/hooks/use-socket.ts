import { useMemo } from 'react';
import { container } from 'tsyringe';
import ISocketService from '../../domain/ports/ISocketService';
import { SOCKET_TOKENS } from '../../infrastructure/di/tokens';

const useSocket = (): ISocketService => {
    const socket = useMemo(() => {
        return container.resolve<ISocketService>(SOCKET_TOKENS.SocketAdapter);
    }, []);

    return socket;
};

export default useSocket;
