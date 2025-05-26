import { useState, useCallback } from 'react';

const useAPI = <T>() => {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (apiCall: () => Promise<T>) => {
        setIsLoading(true);
        setError(null);
        try{
            const result = await apiCall();
            setData(result);
            return result;
        }catch(error){
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setError(errorMessage);
            throw error;
        }finally{
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { data, isLoading, error, execute, reset };
};

export default useAPI;