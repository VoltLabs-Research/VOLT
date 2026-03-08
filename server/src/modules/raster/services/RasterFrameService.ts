import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { inject, injectable } from 'tsyringe';
import type { IRasterFrameReader, RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';

@injectable()
export class RasterFrameService implements IRasterFrameReader {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage
    ) {}

    getRasterFramePNG(trajectoryId: string, timestep: number): Promise<RasterFrameResult> {
        return this.rasterStorage.getRasterFramePNG(trajectoryId, timestep);
    }
};
