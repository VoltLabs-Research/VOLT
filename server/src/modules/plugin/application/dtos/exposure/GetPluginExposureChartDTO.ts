import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface GetPluginExposureChartInputDTO {
    teamId: string;
    artifactId: string;
}

export type GetPluginExposureChartOutputDTO = DownloadStreamOutputDTO;
