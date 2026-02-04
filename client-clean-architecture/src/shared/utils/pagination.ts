interface BuildPaginationQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    searchKey?: string;
    extras?: Record<string, unknown>;
}

export const buildPaginationQuery = ({
    page,
    limit,
    search,
    searchKey = 'q',
    extras
}: BuildPaginationQueryParams): Record<string, unknown> => {
    return {
        ...(page !== undefined ? { page } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(search ? { [searchKey]: search } : {}),
        ...(extras ?? {})
    };
};
