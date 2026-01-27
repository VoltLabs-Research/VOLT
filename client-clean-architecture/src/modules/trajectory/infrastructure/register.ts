import { registerTrajectoryDependencies } from '../application/registry';
import { trajectoryRepository } from './repositories/TrajectoryRepository';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerTrajectoryInfrastructure = (): void => {
    registerTrajectoryDependencies({
        trajectoryRepository,
        socketService
    });
};
