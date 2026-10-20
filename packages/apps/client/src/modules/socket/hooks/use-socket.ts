import socketService from '../services/socket-service';
import type { ISocketService } from '@/modules/socket/contracts/socket-service';

const useSocket = (): ISocketService => {
    return socketService;
};

export default useSocket;
