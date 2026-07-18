import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface ExportPluginOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}

export interface ExportPluginInputDTO {
    pluginId: string;
}
