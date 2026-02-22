import type { ListingRow } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { ExportType } from '@/shared/domain/export/types';

export interface GetPluginListingInputDTO {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
};

export interface ExportPluginListingInputDTO {
    pluginId: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    format: ExportType;
};

export interface GetPluginListingOutputDTO extends PaginatedResponse<ListingRow> {
    _meta?: {
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnConfig[];
    };
};

export type ExportPluginListingOutputDTO = Blob;
