interface GetListingDisplayStateParams {
    dataLength: number;
    isLoading: boolean;
    errorMessage?: string | null;
    isAccessDenied?: boolean;
};

interface ListingDisplayState {
    isInitialLoading: boolean;
    shouldShowContent: boolean;
    shouldShowEmptyState: boolean;
    shouldShowErrorState: boolean;
    shouldShowAccessDeniedState: boolean;
};

const getListingDisplayState = ({
    dataLength,
    isLoading,
    errorMessage,
    isAccessDenied = false
}: GetListingDisplayStateParams): ListingDisplayState => {
    const hasNoData = dataLength === 0;
    const hasError = Boolean(errorMessage);
    const isInitialLoading = isLoading && hasNoData && !isAccessDenied && !hasError;

    return {
        isInitialLoading,
        shouldShowContent: !isAccessDenied && !hasNoData,
        shouldShowEmptyState: !isAccessDenied && !hasError && hasNoData && !isInitialLoading,
        shouldShowErrorState: !isAccessDenied && hasNoData && hasError,
        shouldShowAccessDeniedState: isAccessDenied
    };
};

export default getListingDisplayState;
