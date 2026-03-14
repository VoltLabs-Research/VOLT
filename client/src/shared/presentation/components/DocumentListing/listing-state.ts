export enum ListingDisplayMode {
    Content = 'content',
    Loading = 'loading',
    Empty = 'empty',
    Error = 'error',
    AccessDenied = 'access-denied'
};

interface GetListingDisplayStateParams {
    dataLength: number;
    isLoading: boolean;
    errorMessage?: string | null;
    isAccessDenied?: boolean;
};

interface ListingDisplayState {
    hasNoData: boolean;
    hasError: boolean;
    isInitialLoading: boolean;
    mode: ListingDisplayMode;
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

    let mode = ListingDisplayMode.Content;

    if (isAccessDenied) {
        mode = ListingDisplayMode.AccessDenied;
    } else if (hasNoData && hasError) {
        mode = ListingDisplayMode.Error;
    } else if (isInitialLoading) {
        mode = ListingDisplayMode.Loading;
    } else if (hasNoData) {
        mode = ListingDisplayMode.Empty;
    }

    return {
        hasNoData,
        hasError,
        isInitialLoading,
        mode,
        shouldShowContent: mode === ListingDisplayMode.Content,
        shouldShowEmptyState: mode === ListingDisplayMode.Empty,
        shouldShowErrorState: mode === ListingDisplayMode.Error,
        shouldShowAccessDeniedState: mode === ListingDisplayMode.AccessDenied
    };
};

export type { GetListingDisplayStateParams, ListingDisplayState };
export default getListingDisplayState;
