import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    DisconnectJobSocketUseCase,
    InitializeJobSocketUseCase,
    SubscribeToTeamJobsUseCase
} from './use-cases';

export interface JobsDependencies {
    socketService: ISocketService;
}

export interface JobsUseCases {
    initializeJobSocketUseCase: InitializeJobSocketUseCase;
    subscribeToTeamJobsUseCase: SubscribeToTeamJobsUseCase;
    disconnectJobSocketUseCase: DisconnectJobSocketUseCase;
}

let dependencies: JobsDependencies | null = null;
let useCases: JobsUseCases | null = null;

const buildUseCases = (deps: JobsDependencies): JobsUseCases => ({
    initializeJobSocketUseCase: new InitializeJobSocketUseCase(deps.socketService),
    subscribeToTeamJobsUseCase: new SubscribeToTeamJobsUseCase(deps.socketService),
    disconnectJobSocketUseCase: new DisconnectJobSocketUseCase(deps.socketService)
});

export const registerJobsDependencies = (deps: JobsDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getJobsUseCases = (): JobsUseCases => {
    if (!dependencies) {
        throw new Error('Jobs dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
