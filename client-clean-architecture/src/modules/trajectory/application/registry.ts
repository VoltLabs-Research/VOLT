import type { ITrajectoryRepository } from '../domain/repositories/ITrajectoryRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    TrajectoryPresenceSocketUseCase,
    TrajectoryUpdatesSocketUseCase
} from './use-cases';

export interface TrajectoryDependencies {
    trajectoryRepository: ITrajectoryRepository;
    socketService: ISocketService;
}

export interface TrajectoryUseCases {
    trajectoryPresenceSocketUseCase: TrajectoryPresenceSocketUseCase;
    trajectoryUpdatesSocketUseCase: TrajectoryUpdatesSocketUseCase;
}

let dependencies: TrajectoryDependencies | null = null;
let useCases: TrajectoryUseCases | null = null;

const buildUseCases = (deps: TrajectoryDependencies): TrajectoryUseCases => ({
    trajectoryPresenceSocketUseCase: new TrajectoryPresenceSocketUseCase(deps.socketService),
    trajectoryUpdatesSocketUseCase: new TrajectoryUpdatesSocketUseCase(deps.socketService)
});

export const registerTrajectoryDependencies = (deps: TrajectoryDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getTrajectoryUseCases = (): TrajectoryUseCases => {
    if (!dependencies) {
        throw new Error('Trajectory dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
