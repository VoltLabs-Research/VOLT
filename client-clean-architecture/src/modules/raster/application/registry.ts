import type { IRasterRepository } from '../domain/repositories/IRasterRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import type { IFrameLoader, IHardwareDetector } from './use-cases/PreloadFramesUseCase';
import {
    ApplyColorCodingUseCase,
    GenerateRasterUseCase,
    GetColorCodingPropertiesUseCase,
    GetColorCodingStatsUseCase,
    GetRasterFrameDataUseCase,
    GetRasterMetadataUseCase,
    PreloadFramesUseCase,
    RasterPresenceSocketUseCase
} from './use-cases';

export interface RasterDependencies {
    rasterRepository: IRasterRepository;
    frameLoader: IFrameLoader;
    hardwareDetector: IHardwareDetector;
    socketService: ISocketService;
}

export interface RasterUseCases {
    getRasterMetadataUseCase: GetRasterMetadataUseCase;
    getRasterFrameDataUseCase: GetRasterFrameDataUseCase;
    generateRasterUseCase: GenerateRasterUseCase;
    preloadFramesUseCase: PreloadFramesUseCase;
    applyColorCodingUseCase: ApplyColorCodingUseCase;
    getColorCodingStatsUseCase: GetColorCodingStatsUseCase;
    getColorCodingPropertiesUseCase: GetColorCodingPropertiesUseCase;
    rasterPresenceSocketUseCase: RasterPresenceSocketUseCase;
}

let dependencies: RasterDependencies | null = null;
let useCases: RasterUseCases | null = null;

const buildUseCases = (deps: RasterDependencies): RasterUseCases => ({
    getRasterMetadataUseCase: new GetRasterMetadataUseCase(deps.rasterRepository),
    getRasterFrameDataUseCase: new GetRasterFrameDataUseCase(deps.rasterRepository),
    generateRasterUseCase: new GenerateRasterUseCase(deps.rasterRepository),
    preloadFramesUseCase: new PreloadFramesUseCase(deps.frameLoader, deps.hardwareDetector),
    applyColorCodingUseCase: new ApplyColorCodingUseCase(deps.rasterRepository),
    getColorCodingStatsUseCase: new GetColorCodingStatsUseCase(deps.rasterRepository),
    getColorCodingPropertiesUseCase: new GetColorCodingPropertiesUseCase(deps.rasterRepository),
    rasterPresenceSocketUseCase: new RasterPresenceSocketUseCase(deps.socketService)
});

export const registerRasterDependencies = (deps: RasterDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getRasterUseCases = (): RasterUseCases => {
    if (!dependencies) {
        throw new Error('Raster dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
