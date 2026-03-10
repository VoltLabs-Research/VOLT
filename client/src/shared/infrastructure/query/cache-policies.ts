import queryClient from './query-client';
import type { QueryKey } from '@tanstack/react-query';

type CacheUpdater<TData> = TData | undefined | ((current: TData | undefined) => TData | undefined);

export const createCachePolicy = <TParams>(queryKey: (params: TParams) => QueryKey) => ({
    key: (params: TParams): QueryKey => queryKey(params),
    invalidate: (params: TParams): Promise<void> => queryClient.invalidateQueries({ queryKey: queryKey(params) }),
    set: <TData>(params: TParams, updater: CacheUpdater<TData>): void => {
        queryClient.setQueryData<TData>(queryKey(params), updater);
    },
    get: <TData>(params: TParams): TData | undefined => queryClient.getQueryData<TData>(queryKey(params)),
    restore: <TData>(params: TParams, snapshot: TData): void => {
        queryClient.setQueryData<TData>(queryKey(params), snapshot);
    },
    remove: (params: TParams): void => {
        queryClient.removeQueries({ queryKey: queryKey(params) });
    }
});
