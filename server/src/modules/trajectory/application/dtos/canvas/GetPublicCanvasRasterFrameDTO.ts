import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface GetPublicCanvasRasterFrameInputDTO {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
};

export type GetPublicCanvasRasterFrameOutputDTO = DownloadStreamOutputDTO;
