import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

interface UsePaginationParamsOptions {
    defaultPage?: number;
    defaultLimit?: number;
};

interface PaginationParams {
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
    const [searchParams, setSearchParams] = useSearchParams();
    
    const page = Number(searchParams.get('page')) || defaultPage;
    const limit = Number(searchParams.get('limit')) || defaultLimit;
    const search = searchParams.get('search') || '';
    
    const updateParams = useCallback((updates: Partial<PaginationParams>) => {
        setSearchParams(prev => {
            if(updates.page !== undefined) {
                prev.set('page', String(updates.page));
            }
            if(updates.limit !== undefined) {
                prev.set('limit', String(updates.limit));
            }
            if(updates.search !== undefined) {
                if(updates.search) {
                    prev.set('search', updates.search);
                } else {
                    prev.delete('search');
                }
            }
            return prev;
        });
    }, [setSearchParams]);
    
    const setPage = useCallback((page: number) => {
        updateParams({ page });
    }, [updateParams]);
    
    const setSearch = useCallback((search: string) => {
        updateParams({ search, page: 1 });
    }, [updateParams]);
    
    return { page, limit, search, setPage, setSearch, updateParams };
};

export default usePaginationParams;
