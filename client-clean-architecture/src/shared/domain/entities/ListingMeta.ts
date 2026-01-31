export interface ListingMeta {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string | null;
};

export const initialListingMeta: ListingMeta = {
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
};
