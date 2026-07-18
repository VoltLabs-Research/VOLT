
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureGLBInputDTO {
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
    acceptEncoding?: string;
}

export type GetPluginExposureGLBOutputDTO = DownloadStreamOutputDTO;
