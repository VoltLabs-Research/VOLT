import { registerClusterDependencies } from '../application/registry';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerClusterInfrastructure = (): void => {
    registerClusterDependencies({
        socketService
    });
};
