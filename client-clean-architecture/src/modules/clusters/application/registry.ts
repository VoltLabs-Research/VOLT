import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    InitializeClusterSocketUseCase,
    RequestClusterHistoryUseCase
} from './use-cases';

export interface ClusterDependencies {
    socketService: ISocketService;
}

export interface ClusterUseCases {
    initializeClusterSocketUseCase: InitializeClusterSocketUseCase;
    requestClusterHistoryUseCase: RequestClusterHistoryUseCase;
}

let dependencies: ClusterDependencies | null = null;
let useCases: ClusterUseCases | null = null;

const buildUseCases = (deps: ClusterDependencies): ClusterUseCases => ({
    initializeClusterSocketUseCase: new InitializeClusterSocketUseCase(deps.socketService),
    requestClusterHistoryUseCase: new RequestClusterHistoryUseCase(deps.socketService)
});

export const registerClusterDependencies = (deps: ClusterDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getClusterUseCases = (): ClusterUseCases => {
    if (!dependencies) {
        throw new Error('Cluster dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
