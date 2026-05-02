import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface DownloadPluginBinaryInputDTO {
    teamId: string;
    pluginId: string;
}

export interface DownloadPluginBinaryOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}
