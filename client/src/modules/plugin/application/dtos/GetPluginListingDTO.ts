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

export interface GetPluginListingOutputDTO extends PaginatedResponse<ListingRow> {
    _meta?: {
        pluginSlug: string;
        listingSlug: string;
        exposureId: string;
        columns: ColumnConfig[];
    };
};
