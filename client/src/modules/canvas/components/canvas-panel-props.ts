import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';

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
    rasterContainerSelections?: RasterContainerSelection[];
    activeRasterContainerId?: RasterContainerId;
    onSetActiveRasterContainer?: (containerId: RasterContainerId) => void;
    onUpdateRasterContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
}
