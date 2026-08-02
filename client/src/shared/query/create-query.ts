import queryClient from './query-client';
import { skipToken, useQuery } from '@tanstack/react-query';
import type { FetchQueryOptions, QueryKey, UseQueryOptions } from '@tanstack/react-query';

export type QueryOptions<TData> = Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>;

interface QueryBuildOptions<TData> {
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
};

/**
 * A query hook plus the cache accessors that belong to the same key, so a caller
 * never has to rebuild the key by hand to read or invalidate what the hook wrote.
 */
export const createQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    queryFn: (params: TParams) => Promise<TData>
) => {
    return Object.assign(
        (params: TParams, options?: QueryOptions<TData>) => useQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: () => queryFn(params)
        }),
        {
            set(params: TParams, data: TData): void {
                queryClient.setQueryData(keyFn(params), data);
            },
            fetch(
                params: TParams,
                options?: Omit<FetchQueryOptions<TData>, 'queryKey' | 'queryFn'>
            ): Promise<TData> {
                return queryClient.fetchQuery({
                    ...options,
                    queryKey: keyFn(params),
                    queryFn: () => queryFn(params)
                });
            },
            invalidate(params: TParams): Promise<void> {
                return queryClient.invalidateQueries({ queryKey: keyFn(params) });
            },
            clear(params: TParams): void {
                queryClient.removeQueries({ queryKey: keyFn(params) });
            },
            buildOptions(params: TParams): QueryBuildOptions<TData> {
                return {
                    queryKey: keyFn(params),
                    queryFn: () => queryFn(params)
                };
            }
        }
    );
};

/**
 * A cache entry with no fetcher: the data arrives over a socket, so the query never
 * goes stale on its own and is only ever written through the returned accessors.
 */
export const createSocketQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    config?: { initialData?: TData }
) => {
    return Object.assign(
        (params: TParams, options?: QueryOptions<TData>) => useQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: skipToken,
            initialData: config?.initialData,
            staleTime: Infinity,
            gcTime: Infinity
        }),
        {
            set(params: TParams, data: TData): void {
                queryClient.setQueryData(keyFn(params), data);
            },
            get(params: TParams): TData | undefined {
                return queryClient.getQueryData<TData>(keyFn(params));
            },
            update(params: TParams, updater: (current: TData | undefined) => TData): void {
                queryClient.setQueryData<TData>(keyFn(params), updater);
            },
            reset(params: TParams): void {
                queryClient.removeQueries({ queryKey: keyFn(params) });
            }
        }
    );
};
