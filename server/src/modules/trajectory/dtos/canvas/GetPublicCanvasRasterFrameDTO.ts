import type { DownloadStreamOutputDTO } from '@shared/contracts/types';

export interface GetPublicCanvasRasterFrameInputDTO {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
};

export type GetPublicCanvasRasterFrameOutputDTO = DownloadStreamOutputDTO;
