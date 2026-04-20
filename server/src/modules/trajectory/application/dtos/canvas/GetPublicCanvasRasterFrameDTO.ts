import type { DownloadStreamOutputDTO } from '@modules/raster/application/dtos/shared/DownloadStreamOutputDTO';

export interface GetPublicCanvasRasterFrameInputDTO {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
};

export type GetPublicCanvasRasterFrameOutputDTO = DownloadStreamOutputDTO;
