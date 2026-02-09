interface ListingDisplayState {
    hasNoData: boolean;
    isInitialLoading: boolean;
    shouldShowEmptyState: boolean;
}

const getListingDisplayState = (dataLength: number, isLoading: boolean): ListingDisplayState => {
    const hasNoData = dataLength === 0;
    const isInitialLoading = isLoading && hasNoData;
    const shouldShowEmptyState = hasNoData && !isLoading;

    return {
        hasNoData,
        isInitialLoading,
        shouldShowEmptyState
    };
};

export type { ListingDisplayState };
export default getListingDisplayState;
