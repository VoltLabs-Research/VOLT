import type { IGlbPreloadRepository } from '../domain/repositories/IGlbPreloadRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    CanvasPresenceSocketUseCase,
    ComputeGlbUrlUseCase,
    ComputeTimestepDataUseCase,
    PreloadModelsUseCase
} from './use-cases';

export interface CanvasDependencies {
    glbPreloadRepository: IGlbPreloadRepository;
    socketService: ISocketService;
}

export interface CanvasUseCases {
    canvasPresenceSocketUseCase: CanvasPresenceSocketUseCase;
    computeGlbUrlUseCase: ComputeGlbUrlUseCase;
    computeTimestepDataUseCase: ComputeTimestepDataUseCase;
    preloadModelsUseCase: PreloadModelsUseCase;
}

let dependencies: CanvasDependencies | null = null;
let useCases: CanvasUseCases | null = null;

const buildUseCases = (deps: CanvasDependencies): CanvasUseCases => ({
    canvasPresenceSocketUseCase: new CanvasPresenceSocketUseCase(deps.socketService),
    computeGlbUrlUseCase: new ComputeGlbUrlUseCase(),
    computeTimestepDataUseCase: new ComputeTimestepDataUseCase(),
    preloadModelsUseCase: new PreloadModelsUseCase(deps.glbPreloadRepository)
});

export const registerCanvasDependencies = (deps: CanvasDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getCanvasUseCases = (): CanvasUseCases => {
    if (!dependencies) {
        throw new Error('Canvas dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
