import type { DownloadStreamOutputDTO } from '@modules/raster/application/dtos/shared/DownloadStreamOutputDTO';

export interface GetRasterFramePNGInputDTO {
    trajectoryId: string;
    teamId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
};

export type GetRasterFramePNGOutputDTO = DownloadStreamOutputDTO;
