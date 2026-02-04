import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type SearchParamUpdates = Record<string, string | number | boolean | null | undefined>;

interface UpdateSearchParamsOptions {
    replace?: boolean;
};

interface UseSearchParamsReturn {
    searchParams: URLSearchParams;
    updateSearchParams: (updates: SearchParamUpdates, options?: UpdateSearchParamsOptions) => void;
    setParam: (key: string, value: string, options?: UpdateSearchParamsOptions) => void;
    removeParam: (key: string, options?: UpdateSearchParamsOptions) => void;
};

const useSearchParamsState = (): UseSearchParamsReturn => {
    const [searchParams, setSearchParams] = useSearchParams();

    const updateSearchParams = useCallback((updates: SearchParamUpdates, options?: UpdateSearchParamsOptions) => {
        setSearchParams((prev) => {
            Object.entries(updates).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    prev.delete(key);
                } else {
                    prev.set(key, String(value));
                }
            });
            return prev;
        }, { replace: options?.replace ?? false });
    }, [setSearchParams]);

    const setParam = useCallback((key: string, value: string, options?: UpdateSearchParamsOptions) => {
        updateSearchParams({ [key]: value }, options);
    }, [updateSearchParams]);

    const removeParam = useCallback((key: string, options?: UpdateSearchParamsOptions) => {
        updateSearchParams({ [key]: null }, options);
    }, [updateSearchParams]);

    return { searchParams, updateSearchParams, setParam, removeParam };
};

export default useSearchParamsState;
