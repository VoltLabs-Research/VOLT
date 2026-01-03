import { extractErrorMessage } from '@/utilities/api/error-extractor';
import type { StoreApi } from 'zustand';

export interface AsyncState { isLoading?: boolean; loading?: boolean; error?: string | null;[key: string]: any }

import { useUIStore } from '@/stores/slices/ui';

export interface RunRequestOptions<TResult, TState extends AsyncState> {
    loadingKey?: keyof TState & string;
    errorKey?: keyof TState & string;
    onSuccess?: (result: TResult, set: SetFn<TState>, get: GetFn<TState>) => void;
    onError?: (error: Error, set: SetFn<TState>, get: GetFn<TState>) => void;
    errorFallback?: string;
    rethrow?: boolean;
    skipLoading?: boolean;
    successMessage?: string;
    errorMessage?: string;
}

type SetFn<T> = StoreApi<T>['setState'];
type GetFn<T> = StoreApi<T>['getState'];

export async function runRequest<TResult, TState extends AsyncState = AsyncState>(
    set: (partial: Partial<TState>) => void,
    get: () => TState,
    fn: () => Promise<TResult>,
    opts: RunRequestOptions<TResult, TState> = {}
): Promise<TResult | null> {
    const {
        loadingKey = 'isLoading' as keyof TState & string,
        errorKey = 'error' as keyof TState & string,
        onSuccess,
        onError,
        errorFallback = 'An error occurred',
        rethrow = false,
        skipLoading = false,
        successMessage,
        errorMessage
    } = opts;

    if (!skipLoading) set({ [loadingKey]: true, [errorKey]: null } as Partial<TState>);

    try {
        const result = await fn();
        if (!skipLoading) set({ [loadingKey]: false } as Partial<TState>);

        if (successMessage) {
            useUIStore.getState().addToast(successMessage, 'success');
        }

        if (onSuccess) onSuccess(result, set as SetFn<TState>, get as GetFn<TState>);
        return result;
    } catch (error: any) {
        const errorMsg = extractErrorMessage(error, errorFallback);
        set({ [loadingKey]: false, [errorKey]: errorMsg } as Partial<TState>);

        if (errorMessage || (opts.errorFallback && opts.errorFallback !== 'An error occurred')) {
            // If implicit error fallback is provided or explicit errorMessage
            const msg = errorMessage || errorMsg || errorFallback;
            // Only show toast if specifically requested via errorMessage OR if we want to show all errors by default?
            // The prompt asks to show feedback. Showing error feedback is good.
            // But existing code might rely on errorFallback just for state.
            // Let's rely on errorMessage param for explicit toast, OR if errorFallback was custom (not default)
            // Actually, let's keep it simple: if errorMessage is provided, show it.
            // If not, we don't auto-toast errors unless we are sure.
            // But for "Rasterize" etc, we want feedback.
            if (errorMessage) {
                useUIStore.getState().addToast(errorMessage, 'error');
            }
        }

        if (onError) onError(error as Error, set as SetFn<TState>, get as GetFn<TState>);
        if (rethrow) throw error;
        return null;
    }
}
