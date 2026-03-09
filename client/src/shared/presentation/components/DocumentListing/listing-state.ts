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
    const isInitialLoading = isLoading && hasNoData;

    let mode = ListingDisplayMode.Content;

    if (isInitialLoading) {
        mode = ListingDisplayMode.Loading;
    } else if (isAccessDenied) {
        mode = ListingDisplayMode.AccessDenied;
    } else if (hasNoData && errorMessage) {
        mode = ListingDisplayMode.Error;
    } else if (hasNoData) {
        mode = ListingDisplayMode.Empty;
    }

    return {
        hasNoData,
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
