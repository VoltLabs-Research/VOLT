import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface ExportPluginOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}

export interface ExportPluginInputDTO {
    pluginId: string;
}
