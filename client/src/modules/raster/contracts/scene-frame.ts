import type { RasterFrameScope } from '@volt/contracts/modules/raster/domain';

export interface RasterSceneFrame{
    frame: number;
    model: string | null;
    analysisId: string | null;
    scope: RasterFrameScope;
    imageUrl: string | null;
}
