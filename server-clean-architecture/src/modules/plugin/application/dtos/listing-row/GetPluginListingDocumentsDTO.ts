export interface GetPluginListingDocumentsInputDTO {
    pluginSlug: string;
    listingSlug: string;
    teamId: string;
    trajectoryId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
    afterCursor?: string;
}

export interface GetPluginListingDocumentsOutputDTO {
    [key: string]: any;
}
