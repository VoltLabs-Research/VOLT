import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';

export const RASTER_TOKENS = Object.freeze({
    RasterService: Symbol.for('RasterService'),
    RasterFrameReader: Symbol.for('RasterFrameReader'),
    RasterJobEnqueuer: Symbol.for('RasterJobEnqueuer'),
    RasterStorageService: RASTER_CONTRACT_TOKENS.RasterStorageService,
    GetRasterMetadataUseCase: RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase,
    RasterMetadataService: Symbol.for('RasterMetadataService')
});
