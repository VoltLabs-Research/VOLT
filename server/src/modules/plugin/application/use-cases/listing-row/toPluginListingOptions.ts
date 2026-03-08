import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { ListingOptions } from '@modules/plugin/domain/port/PluginListingTypes';

type ListingDocumentsInput = GetPluginListingDocumentsInputDTO | ExportPluginListingDocumentsInputDTO;

export const toPluginListingOptions = (input: ListingDocumentsInput): ListingOptions => {
    return {
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        analysisId: input.analysisId,
        exposureId: input.exposureId,
        exposureName: input.exposureName,
        sortAsc: input.sortAsc
    };
};
