import type { ExportType } from '@/shared/domain/export/types';

export interface ExportPluginListingInputDTO {
    pluginId: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    format: ExportType;
}
