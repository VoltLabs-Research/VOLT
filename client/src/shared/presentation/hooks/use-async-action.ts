import { useState, useCallback } from 'react';

interface UseAsyncActionOptions {
    /** Called when the action fails */
    onError?: (error: unknown) => void;
    /** Called when the action completes (success or failure) */
    onFinally?: () => void;
}

interface UseAsyncActionReturn {
    isLoading: boolean;
    error: unknown | null;
    /** Execute an async action with automatic loading state management */
    execute: <T>(action: () => Promise<T>) => Promise<T | undefined>;
    /** Reset the error state */
    clearError: () => void;
}

/**
 * Hook for managing async action loading states.
 * Provides automatic loading/error state management for async operations.
 * 
 */
const useAsyncAction = (options?: UseAsyncActionOptions): UseAsyncActionReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<unknown | null>(null);

    const execute = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
        setIsLoading(true);
        setError(null);
        
        try {
            return await action();
        } catch (err) {
            setError(err);
            options?.onError?.(err);
            return undefined;
        } finally {
            setIsLoading(false);
            options?.onFinally?.();
        }
    }, [options?.onError, options?.onFinally]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return { isLoading, error, execute, clearError };
};

export default useAsyncAction;
