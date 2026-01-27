import type { IContainerRepository } from '../domain/repositories/IContainerRepository';
import type { ISocketService, ISystemService } from '@/shared/domain/repositories';
import {
    ContainerTerminalSocketUseCase
} from './use-cases';

export interface ContainerDependencies {
    containerRepository: IContainerRepository;
    socketService: ISocketService;
    systemService: ISystemService;
}

export interface ContainerUseCases {
    containerTerminalSocketUseCase: ContainerTerminalSocketUseCase;
}

let dependencies: ContainerDependencies | null = null;
let useCases: ContainerUseCases | null = null;

const buildUseCases = (deps: ContainerDependencies): ContainerUseCases => ({
    containerTerminalSocketUseCase: new ContainerTerminalSocketUseCase(deps.socketService)
});

export const registerContainerDependencies = (deps: ContainerDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getContainerUseCases = (): ContainerUseCases => {
    if (!dependencies) {
        throw new Error('Container dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
