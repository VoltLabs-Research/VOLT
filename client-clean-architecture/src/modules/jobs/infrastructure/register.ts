import { registerJobsDependencies } from '../application/registry';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerJobsInfrastructure = (): void => {
    registerJobsDependencies({
        socketService
    });
};
