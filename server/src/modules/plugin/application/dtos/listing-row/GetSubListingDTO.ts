/**
 * Re-export shim. The canonical get-sub-listing DTOs now live in the neutral
 * `@shared/contracts/dtos/GetSubListingDTO` (detachable-modules migration).
 * Existing `@modules/plugin/application/dtos/listing-row/GetSubListingDTO`
 * importers keep working unchanged.
 */
export type {
    GetSubListingInputDTO,
    SubListingColumn,
    SubListingRowShape,
    SubListingRowData,
    GetSubListingOutputDTO
} from '@shared/contracts/dtos/GetSubListingDTO';
