import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import { RasterMetadataService } from '@modules/raster/infrastructure/services/RasterMetadataService';
import { RasterFrameService } from '@modules/raster/infrastructure/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/infrastructure/services/RasterJobEnqueuerService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const rasterDIManifest: ModuleManifest = {
    name: 'raster',
    singletons: [
        [RASTER_TOKENS.RasterStorage, RasterStorageService],
        [RASTER_TOKENS.RasterMetadataReader, RasterMetadataService],
        [RASTER_TOKENS.RasterFrameReader, RasterFrameService],
        [RASTER_TOKENS.RasterJobEnqueuer, RasterJobEnqueuerService]
    ]
};
