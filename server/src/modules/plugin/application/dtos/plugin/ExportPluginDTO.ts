import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

export interface ExportPluginOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}

export interface ExportPluginInputDTO{
    pluginId: string;
};
