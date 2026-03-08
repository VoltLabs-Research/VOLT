import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface PluginExposureExportParams {
    analysisId: string;
    trajectoryId: string;
    pluginName: string;
};

export interface IPluginExposureExportService {
    exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutputDTO>;
};
