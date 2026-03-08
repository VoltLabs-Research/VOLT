import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface GetPluginExposureGLBInputDTO {
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
};

export type GetPluginExposureGLBOutputDTO = DownloadStreamOutputDTO;
