import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureChartInputDTO {
    teamId: string;
    artifactId: string;
}

export type GetPluginExposureChartOutputDTO = DownloadStreamOutputDTO;
