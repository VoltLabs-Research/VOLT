import { extractErrorMessage } from '@/utilities/api/error-extractor';
import type { StoreApi } from 'zustand';

export interface AsyncState { isLoading?: boolean; loading?: boolean; error?: string | null;[key: string]: any }

export interface RunRequestOptions<TResult, TState extends AsyncState> {
    loadingKey?: keyof TState & string;
    errorKey?: keyof TState & string;
    onSuccess?: (result: TResult, set: SetFn<TState>, get: GetFn<TState>) => void;
    onError?: (error: Error, set: SetFn<TState>, get: GetFn<TState>) => void;
    errorFallback?: string;
    rethrow?: boolean;
    skipLoading?: boolean;
}

type SetFn<T> = StoreApi<T>['setState'];
type GetFn<T> = StoreApi<T>['getState'];

export async function runRequest<TResult, TState extends AsyncState = AsyncState>(
    set: (partial: Partial<TState>) => void,
    get: () => TState,
    fn: () => Promise<TResult>,
    opts: RunRequestOptions<TResult, TState> = {}
): Promise<TResult | null> {
    const { loadingKey = 'isLoading' as keyof TState & string, errorKey = 'error' as keyof TState & string, onSuccess, onError, errorFallback = 'An error occurred', rethrow = false, skipLoading = false } = opts;

    if (!skipLoading) set({ [loadingKey]: true, [errorKey]: null } as Partial<TState>);

    try {
        const result = await fn();
        if (!skipLoading) set({ [loadingKey]: false } as Partial<TState>);
        if (onSuccess) onSuccess(result, set as SetFn<TState>, get as GetFn<TState>);
        return result;
    } catch (error) {
        set({ [loadingKey]: false, [errorKey]: extractErrorMessage(error, errorFallback) } as Partial<TState>);
        if (onError) onError(error as Error, set as SetFn<TState>, get as GetFn<TState>);
        if (rethrow) throw error;
        return null;
    }
}
