import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

export interface PluginExposureExportParams {
    analysisId: string;
    trajectoryId: string;
    pluginName: string;
}

export interface IPluginExposureExportService {
    exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutputDTO>;
}
