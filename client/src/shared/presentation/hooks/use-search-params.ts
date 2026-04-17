export type SearchParamUpdates = Record<string, string | number | boolean | null | undefined>;

export const applySearchParamUpdates = (
    searchParams: URLSearchParams,
    updates: SearchParamUpdates
): URLSearchParams => {
    const nextSearchParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            nextSearchParams.delete(key);
            return;
        }

        nextSearchParams.set(key, String(value));
    });

    return nextSearchParams;
};
