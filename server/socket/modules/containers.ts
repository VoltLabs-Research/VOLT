import { Server, Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import { handleContainerTerminal } from '@/controllers/container';
import logger from '@/logger';

class ContainerModule extends BaseSocketModule {
    constructor() {
        super('ContainerModule');
    }

    onInit(io: Server): void {
        this.io = io;
    }

    onConnection(socket: Socket): void {
        const user = (socket as any).user;
        if (!user) {
            return;
        }

        // Delegate to controller handler
        handleContainerTerminal(socket);

        logger.info(`[ContainerModule] Initialized for user ${user.firstName} ${user.lastName}`);
    }
}

export default ContainerModule;
