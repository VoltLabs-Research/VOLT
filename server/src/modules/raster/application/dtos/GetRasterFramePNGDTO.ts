import type { DownloadStreamOutputDTO } from '@modules/raster/application/dtos/shared/DownloadStreamOutputDTO';

export interface GetRasterFramePNGInputDTO {
    trajectoryId: string;
    timestep: number;
};

export type GetRasterFramePNGOutputDTO = DownloadStreamOutputDTO;
