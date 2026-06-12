/**
 * Neutral, cross-module DTO contract for the get-sub-listing use case.
 *
 * Extracted from `@modules/plugin/application/dtos/listing-row/GetSubListingDTO`
 * during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasSubListingUseCase` consumes `GetSubListingOutputDTO` (and the
 * `IGetSubListingUseCase` port returns it). The owner DTO file re-exports these
 * so existing importers compile unchanged. Pure types — no `@modules/*`.
 */
export interface GetSubListingInputDTO {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    teamId: string;
    page?: number;
    limit?: number;
}

export interface SubListingColumn {
    label: string;
    sortable: boolean;
}

export interface SubListingRowShape {
    _id: string;
}

export type SubListingRowData = SubListingRowShape;

export interface GetSubListingOutputDTO {
    subListingName: string;
    columns: SubListingColumn[];
    rows: SubListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}
