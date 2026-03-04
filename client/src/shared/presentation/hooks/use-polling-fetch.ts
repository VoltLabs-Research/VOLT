import { useState, useEffect, useCallback, useRef } from 'react';

const usePollingFetch = <T>(
    fetcher: () => Promise<T>,
    interval: number = 60_000,
    enabled: boolean = true
): { data: T | null; isLoading: boolean; error: Error | null; refetch: () => Promise<void> } => {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const executeFetch = useCallback(async () => {
        try {
            const result = await fetcher();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Fetch failed'));
            setData(null);
        }
    }, [fetcher]);

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const init = async () => {
            setIsLoading(true);
            await executeFetch();
            if (!cancelled) {
                setIsLoading(false);
                intervalRef.current = setInterval(executeFetch, interval);
            }
        };

        init();

        return () => {
            cancelled = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [executeFetch, interval, enabled]);

    const refetch = useCallback(async () => {
        await executeFetch();
    }, [executeFetch]);

    return { data, isLoading, error, refetch };
};

export default usePollingFetch;
