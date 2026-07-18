
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureExportInputDTO {
    teamId: string;
    analysisId: string;
}

export type GetPluginExposureExportOutputDTO = DownloadStreamOutputDTO;
