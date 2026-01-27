import { registerRasterDependencies } from '../application/registry';
import { rasterRepository } from './repositories/RasterRepository';
import { HardwareDetectorAdapter } from './adapters/HardwareDetectorAdapter';
import { FrameLoaderAdapter } from './adapters/FrameLoaderAdapter';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerRasterInfrastructure = (): void => {
    registerRasterDependencies({
        rasterRepository,
        hardwareDetector: new HardwareDetectorAdapter(),
        frameLoader: new FrameLoaderAdapter(rasterRepository),
        socketService
    });
};
