import { Server, Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import ContainerController from '@/controllers/container';
import logger from '@/logger';

class ContainerModule extends BaseSocketModule {
    private containerController: ContainerController;

    constructor() {
        super('ContainerModule');
        this.containerController = new ContainerController();
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
        this.containerController.handleContainerTerminal(socket);

        logger.info(`[ContainerModule] Initialized for user ${user.firstName} ${user.lastName}`);
    }
}

export default ContainerModule;
