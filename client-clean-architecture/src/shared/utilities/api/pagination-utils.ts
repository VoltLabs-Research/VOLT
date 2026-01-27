export interface ListingMeta {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export const initialListingMeta: ListingMeta = {
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
};

interface PaginationResult<T> {
    data: T[];
    listingMeta: ListingMeta;
}

interface CalculatePaginationParams<T> {
    newData: T[];
    currentData: T[];
    page: number;
    limit: number;
    append: boolean;
    totalFromApi?: number;
    previousTotal?: number;
}

export const calculatePaginationState = <T>(params: CalculatePaginationParams<T>): PaginationResult<T> => {
    const { newData, currentData, page, limit, append, totalFromApi, previousTotal } = params;

    const mergedData = append ? [...currentData, ...newData] : newData;
    const hasMore = newData.length === limit;

    let total = totalFromApi;

    if (total === undefined) {
        if (append && previousTotal && previousTotal > 0) {
            total = previousTotal;
        } else {
            total = (page - 1) * limit + newData.length;
        }

        if (hasMore && total <= mergedData.length) {
            total = mergedData.length + 1;
        }
    }

    return {
        data: mergedData,
        listingMeta: {
            page,
            limit,
            total,
            hasMore
        }
    };
};
