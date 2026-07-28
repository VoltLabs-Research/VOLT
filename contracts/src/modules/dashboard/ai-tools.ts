export interface GetDashboardMetricsInput{}

export interface GlobalSearchInput{
    /**
     * Free-text search term (at least 2 characters to match anything).
     */
    query?: string;
    /**
     * Max results per entity type (1-10, default 5).
     */
    limit?: number;
}
