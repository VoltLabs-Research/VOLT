import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface DownloadPluginBinaryInputDTO {
    teamId: string;
    pluginId: string;
}

export interface DownloadPluginBinaryOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}
