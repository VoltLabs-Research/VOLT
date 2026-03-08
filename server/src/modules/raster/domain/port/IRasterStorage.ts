import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';

export interface IRasterStorage {
    listModelFiles(trajectoryId: string): AsyncIterable<string>;
    listPreviewFiles(trajectoryId: string): AsyncIterable<string>;
    getRasterFramePNG(trajectoryId: string, timestep: number): Promise<RasterFrameResult>;
}
