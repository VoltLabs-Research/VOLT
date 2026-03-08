import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

export interface GetPluginExposureExportInputDTO {
    teamId: string;
    analysisId: string;
}

export type GetPluginExposureExportOutputDTO = DownloadStreamOutputDTO;
