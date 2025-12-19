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

/**
 * Calculates the new data array and listing metadata based on pagination parameters.
 * Handles append logic and total count estimation if API response lacks total.
 */
export const calculatePaginationState = <T>(params: CalculatePaginationParams<T>): PaginationResult<T> => {
    const { newData, currentData, page, limit, append, totalFromApi, previousTotal } = params;

    const mergedData = append ? [...currentData, ...newData] : newData;

    const hasMore = newData.length === limit;

    let total = totalFromApi;

    if(total === undefined){
        // If API doesn't provide total, estimate it
        if(append && previousTotal && previousTotal > 0){
            // Keep existing total if we are just appending and don't have better info
            total = previousTotal;
        }else{
            // Calculate based on what we have seen so far
            total = (page - 1) * limit + newData.length;
        }

        // If we know there's more, ensure total > current count
        if(hasMore && total <= mergedData.length){
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
