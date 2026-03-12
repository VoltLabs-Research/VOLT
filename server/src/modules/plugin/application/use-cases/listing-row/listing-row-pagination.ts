interface ListingPaginationInput {
    page?: number;
    limit?: number;
};

interface ListingPagination {
    page: number;
    limit: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const resolveListingPagination = ({
    page,
    limit
}: ListingPaginationInput): ListingPagination => {
    return {
        page: Math.max(DEFAULT_PAGE, Number(page) || DEFAULT_PAGE),
        limit: Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))
    };
};
