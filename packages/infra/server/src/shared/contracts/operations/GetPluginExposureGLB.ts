
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureGLBInput {
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
    acceptEncoding?: string;
}

export type GetPluginExposureGLBOutput = DownloadStreamOutput;
