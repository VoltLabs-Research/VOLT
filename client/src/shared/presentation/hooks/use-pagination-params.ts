import { useCallback } from 'react';
import useSearchParamsState from './use-search-params';

interface UsePaginationParamsOptions {
    defaultPage?: number;
    defaultLimit?: number;
};

export interface PaginationParams {
    page: number;
    limit: number;
    search: string;
};

interface UsePaginationParamsReturn extends PaginationParams {
    setPage: (page: number) => void;
    setSearch: (search: string) => void;
    updateParams: (updates: Partial<PaginationParams>) => void;
};

const usePaginationParams = (options: UsePaginationParamsOptions = {}): UsePaginationParamsReturn => {
    const { defaultPage = 1, defaultLimit = 20 } = options;
    const { searchParams, updateSearchParams } = useSearchParamsState();
    
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const searchParam = searchParams.get('search');

    const parsedPage = pageParam === null ? NaN : Number(pageParam);
    const parsedLimit = limitParam === null ? NaN : Number(limitParam);

    const page = Number.isNaN(parsedPage) ? defaultPage : parsedPage;
    const limit = Number.isNaN(parsedLimit) ? defaultLimit : parsedLimit;
    const search = searchParam === null ? '' : searchParam;
    
    const updateParams = useCallback((updates: Partial<PaginationParams>) => {
        updateSearchParams({
            ...(updates.page !== undefined ? { page: updates.page } : {}),
            ...(updates.limit !== undefined ? { limit: updates.limit } : {}),
            ...(updates.search !== undefined ? { search: updates.search === '' ? null : updates.search } : {})
        });
    }, [updateSearchParams]);
    
    const setPage = useCallback((page: number) => {
        updateParams({ page });
    }, [updateParams]);
    
    const setSearch = useCallback((search: string) => {
        updateParams({ search, page: 1 });
    }, [updateParams]);
    
    return { page, limit, search, setPage, setSearch, updateParams };
};

export default usePaginationParams;
