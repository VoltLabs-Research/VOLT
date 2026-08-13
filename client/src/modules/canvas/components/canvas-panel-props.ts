export interface CanvasExposureDownloadParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
}

export interface CanvasPanelActionProps {
    onDownloadAnalysis?: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: CanvasExposureDownloadParams) => void;
}
