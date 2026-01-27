import { registerCanvasDependencies } from '../application/registry';
import { glbPreloadRepository } from './repositories/GlbPreloadRepository';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerCanvasInfrastructure = (): void => {
    registerCanvasDependencies({
        glbPreloadRepository,
        socketService
    });
};
