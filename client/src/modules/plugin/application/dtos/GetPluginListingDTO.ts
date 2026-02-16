import type { ListingRow } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

export interface GetPluginListingInputDTO {
    pluginSlug: string;
    listingSlug?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
};

export interface ExportPluginListingInputDTO {
    pluginSlug: string;
    exposureId: string;
    trajectoryId?: string;
    analysisId?: string;
    listingSlug?: string;
};

export interface GetPluginListingOutputDTO extends PaginatedResponse<ListingRow> {
    _meta?: {
        pluginSlug: string;
        listingSlug: string;
        exposureId: string;
        columns: ColumnConfig[];
    };
};

export interface ExportPluginListingOutputDTO {
    meta: {
        pluginSlug: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
    };
    data: ListingRow[];
};
