import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface GetPluginExposureExportInputDTO {
    teamId: string;
    analysisId: string;
}

export type GetPluginExposureExportOutputDTO = DownloadStreamOutputDTO;
