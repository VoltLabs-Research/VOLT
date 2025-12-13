import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const useUrlState = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
        setSearchParams((current) => {
            const newParams = new URLSearchParams(current);
            Object.entries(updates).forEach(([ key, value ]) => {
                if(value === null || value === '' || value === undefined){
                    newParams.delete(key);
                }else{
                    newParams.set(key, value);
                }
            });

            return newParams;
        }, { replace: true });
    }, [setSearchParams]);

    const getUrlParam = useCallback((key: string): string | null =>{
        return searchParams.get(key);
    }, [searchParams]);

    return { updateUrlParams, getUrlParam };
};

export default useUrlState;
