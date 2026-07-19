
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureExportInput {
    teamId: string;
    analysisId: string;
}

export type GetPluginExposureExportOutput = DownloadStreamOutput;
