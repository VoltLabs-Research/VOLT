/**
 * Base pagination parameters for API requests.
 * All listings should extend this interface.
 */
export interface PaginationRequest {
    page?: number;
    limit?: number;
};

/**
 * Pagination parameters with search capability.
 */
export interface SearchablePaginationRequest extends PaginationRequest {
    search?: string;
};

/**
 * Pagination parameters with cursor for infinite scroll.
 */
export interface CursorPaginationRequest extends PaginationRequest {
    cursor?: string | null;
};

/**
 * Default pagination values.
 */
export const DEFAULT_PAGINATION: Required<PaginationRequest> = {
    page: 1,
    limit: 20
};
