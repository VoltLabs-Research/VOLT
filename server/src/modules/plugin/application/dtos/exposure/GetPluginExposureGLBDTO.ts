import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

export interface GetPluginExposureGLBInputDTO {
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
}

export type GetPluginExposureGLBOutputDTO = DownloadStreamOutputDTO;
