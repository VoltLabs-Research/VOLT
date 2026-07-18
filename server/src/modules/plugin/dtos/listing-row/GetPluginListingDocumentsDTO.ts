/**
 * Re-export shim. The canonical get/export-plugin-listing-documents DTOs now
 * live in the neutral `@shared/contracts/dtos/GetPluginListingDocumentsDTO`
 * (detachable-modules migration). Existing
 * `@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO`
 * importers (the export use case, daemon-listing types, listing enrichment) keep
 * working unchanged.
 */
export type {
    GetPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsInputDTO,
    ColumnDef,
    ListingRowData,
    PluginListingDocumentsMeta,
    GetPluginListingDocumentsOutputDTO
} from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';
