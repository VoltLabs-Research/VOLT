import { registerContainerDependencies } from '../application/registry';
import { containerRepository } from './repositories/ContainerRepository';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';
import { systemService } from '@/shared/infrastructure/services/SystemService';

export const registerContainerInfrastructure = (): void => {
    registerContainerDependencies({
        containerRepository,
        socketService,
        systemService
    });
};
