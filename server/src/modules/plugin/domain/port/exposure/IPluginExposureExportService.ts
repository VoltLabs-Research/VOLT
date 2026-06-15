import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface PluginExposureExportParams {
    analysisId: string;
    trajectoryId: string;
    pluginName: string;
}

export interface IPluginExposureExportService {
    exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutputDTO>;
}
