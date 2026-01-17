export interface GetPluginListingDocumentsInputDTO {
    pluginSlug: string;
    listingSlug: string;
    page?: number;
    limit?: number;
}

export interface GetPluginListingDocumentsOutputDTO {
    [key: string]: any;
}
