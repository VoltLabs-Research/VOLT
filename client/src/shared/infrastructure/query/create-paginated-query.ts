import { useMutation, useQuery, useInfiniteQuery, skipToken } from '@tanstack/react-query';
import type {
    UseQueryOptions,
    UseMutationOptions,
    QueryKey,
    InfiniteData,
    UseInfiniteQueryOptions,
    FetchQueryOptions
} from '@tanstack/react-query';
import type { MutationFunctionContext } from '@tanstack/query-core';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import queryClient from './query-client';

export type QueryOptions<TData> = Omit<
    UseQueryOptions<TData>,
    'queryKey' | 'queryFn'
>;

export type MutationOptions<TData, TVariables> = Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn'
>;

export type InfiniteQueryOptions<TData> = Omit<
    UseInfiniteQueryOptions<TData, Error, InfiniteData<TData>>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

type UpdateVariables<TUpdateParams> = {
    id: string;
    params: TUpdateParams;
};

interface WithId {
    _id: string;
}

// ---------------------------------------------------------------------------
// buildKeys — typed key map with void support
// ---------------------------------------------------------------------------
// For void params:  buildKeys<{ currentUser: void }>('auth').currentUser
//                   → (params: void) ⇒ ['auth', 'currentUser']
// For typed params: buildKeys<{ detail: string }>('container').detail
//                   → (params: string) ⇒ ['container', 'detail', params]
//
// Array base (hierarchical keys):
//   buildKeys<{ list: Params }>(['plugins', 'catalog']).list
//     → (params: Params) ⇒ ['plugins', 'catalog', 'list', params]
//   buildKeys<{ list: Params }>(['plugins', 'catalog']).prefix()
//     → ['plugins', 'catalog']           (group prefix for invalidation)
// ---------------------------------------------------------------------------

type KeyFnMap<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends void
        ? (params?: void) => QueryKey
        : (() => QueryKey) & ((params: T[K]) => QueryKey);
} & {
    /** Returns the base prefix (no key name), useful for prefix-based invalidation. */
    prefix: () => QueryKey;
};

export const buildKeys = <T extends Record<string, unknown>>(base: string | readonly string[]): KeyFnMap<T> => {
    const baseSegments = typeof base === 'string' ? [base] : [...base];
    return new Proxy({} as KeyFnMap<T>, {
        get: (_, key: string) => {
            if (key === 'prefix') {
                return () => [...baseSegments];
            }
            return (params: unknown) =>
                params === undefined || params === null
                    ? [...baseSegments, key]
                    : [...baseSegments, key, params];
        }
    });
};

// ---------------------------------------------------------------------------
// withSuccess — compose internal cache-update handler with consumer onSuccess
// ---------------------------------------------------------------------------
// Usage (inside a useMutation call):
//   onSuccess: withSuccess((data) => cache.set(data), options)
//
// This ensures the internal handler runs first, then the consumer's onSuccess.
// ---------------------------------------------------------------------------

export const withSuccess = <TData, TVariables, TOnMutateResult = unknown>(
    handler: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void,
    options?: { onSuccess?: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => unknown }
): ((data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void) => {
    return (data, variables, onMutateResult, context) => {
        handler(data, variables, onMutateResult, context);
        options?.onSuccess?.(data, variables, onMutateResult, context);
    };
};

// ---------------------------------------------------------------------------
// createQuery — returns a callable hook with static cache helpers
// ---------------------------------------------------------------------------
// const detail = createQuery(KEYS.detail, service.getById);
//
// // As a hook:
// detail(id, { staleTime: Infinity })
//
// // Statics:
// detail.set(id, data)          — setQueryData
// detail.fetch(id, opts)        — fetchQuery
// detail.invalidate(id)         — invalidateQueries
// detail.clear(id)              — removeQueries
// detail.buildOptions(id)       — { queryKey, queryFn } for useQueries / prefetch
// ---------------------------------------------------------------------------

interface QueryHookStatics<TParams, TData> {
    set: (params: TParams, data: TData) => void;
    fetch: (params: TParams, options?: Omit<FetchQueryOptions<TData>, 'queryKey' | 'queryFn'>) => Promise<TData>;
    invalidate: (params: TParams) => Promise<void>;
    clear: (params: TParams) => void;
    buildOptions: (params: TParams) => { queryKey: QueryKey; queryFn: () => Promise<TData> };
}

type QueryHook<TParams, TData> =
    ((params: TParams, options?: QueryOptions<TData>) => ReturnType<typeof useQuery<TData>>)
    & QueryHookStatics<TParams, TData>;

export const createQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    queryFn: (params: TParams) => Promise<TData>
): QueryHook<TParams, TData> => {
    const hook = (params: TParams, options?: QueryOptions<TData>) => {
        return useQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: () => queryFn(params)
        });
    };

    hook.set = (params: TParams, data: TData): void => {
        queryClient.setQueryData(keyFn(params), data);
    };

    hook.fetch = (params: TParams, options?: Omit<FetchQueryOptions<TData>, 'queryKey' | 'queryFn'>): Promise<TData> => {
        return queryClient.fetchQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: () => queryFn(params)
        });
    };

    hook.invalidate = (params: TParams): Promise<void> => {
        return queryClient.invalidateQueries({ queryKey: keyFn(params) });
    };

    hook.clear = (params: TParams): void => {
        queryClient.removeQueries({ queryKey: keyFn(params) });
    };

    hook.buildOptions = (params: TParams) => ({
        queryKey: keyFn(params),
        queryFn: () => queryFn(params)
    });

    return hook as QueryHook<TParams, TData>;
};

// ---------------------------------------------------------------------------
// createSocketQuery — for skipToken / socket-driven data
// ---------------------------------------------------------------------------
// const metrics = createSocketQuery(KEYS.metrics, { initialData: undefined });
//
// // Hook uses skipToken (no fetch), data is set externally via socket events:
// metrics(params)
// metrics.set(params, data)
// metrics.get(params)
// metrics.update(params, updater)
// metrics.reset(params)
// ---------------------------------------------------------------------------

interface SocketQueryStatics<TParams, TData> {
    set: (params: TParams, data: TData) => void;
    get: (params: TParams) => TData | undefined;
    update: (params: TParams, updater: (current: TData | undefined) => TData) => void;
    reset: (params: TParams) => void;
}

type SocketQueryHook<TParams, TData> =
    ((params: TParams, options?: QueryOptions<TData>) => ReturnType<typeof useQuery<TData>>)
    & SocketQueryStatics<TParams, TData>;

export const createSocketQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    config?: { initialData?: TData }
): SocketQueryHook<TParams, TData> => {
    const hook = (params: TParams, options?: QueryOptions<TData>) => {
        return useQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: skipToken as any,
            initialData: config?.initialData,
            staleTime: Infinity,
            gcTime: Infinity
        });
    };

    hook.set = (params: TParams, data: TData): void => {
        queryClient.setQueryData(keyFn(params), data);
    };

    hook.get = (params: TParams): TData | undefined => {
        return queryClient.getQueryData<TData>(keyFn(params));
    };

    hook.update = (params: TParams, updater: (current: TData | undefined) => TData): void => {
        queryClient.setQueryData<TData>(keyFn(params), (current) => updater(current));
    };

    hook.reset = (params: TParams): void => {
        queryClient.removeQueries({ queryKey: keyFn(params) });
    };

    return hook as SocketQueryHook<TParams, TData>;
};

// ---------------------------------------------------------------------------
// createInfiniteQuery — standalone infinite query factory
// ---------------------------------------------------------------------------
// const messages = createInfiniteQuery(
//     KEYS.messages,
//     (params, { page, limit }) => chatService.getMessages({ ...params, page, limit }),
//     { defaultLimit: 30 }
// );
//
// // As a hook:
// messages(params, options)
//
// // Statics:
// messages.setData(params, updater)
// messages.invalidate(params)
// messages.clear(params)
// ---------------------------------------------------------------------------

interface InfiniteQueryStatics<TParams, TEntity> {
    setData: (
        params: TParams,
        updater: (current: InfiniteData<PaginatedResponse<TEntity>> | undefined) => InfiniteData<PaginatedResponse<TEntity>> | undefined
    ) => void;
    invalidate: (params: TParams) => Promise<void>;
    clear: (params: TParams) => void;
}

type InfiniteQueryHook<TParams, TEntity> =
    ((params: TParams, options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>) => ReturnType<typeof useInfiniteQuery<PaginatedResponse<TEntity>, Error, InfiniteData<PaginatedResponse<TEntity>>>>)
    & InfiniteQueryStatics<TParams, TEntity>;

interface InfiniteQueryConfig {
    defaultLimit?: number;
}

export const createInfiniteQuery = <TParams, TEntity>(
    keyFn: (params: TParams) => QueryKey,
    fetchPage: (params: TParams, pagination: { page: number; limit: number }) => Promise<PaginatedResponse<TEntity>>,
    config?: InfiniteQueryConfig
): InfiniteQueryHook<TParams, TEntity> => {
    const limit = config?.defaultLimit ?? 20;

    const hook = (params: TParams, options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>) => {
        return useInfiniteQuery({
            ...options,
            queryKey: keyFn(params),
            queryFn: ({ pageParam }) => fetchPage(params, { page: pageParam as number, limit }),
            initialPageParam: 1,
            getNextPageParam: (lastPage) =>
                lastPage.pagination.hasMore
                    ? lastPage.pagination.page + 1
                    : undefined
        });
    };

    hook.setData = (
        params: TParams,
        updater: (current: InfiniteData<PaginatedResponse<TEntity>> | undefined) => InfiniteData<PaginatedResponse<TEntity>> | undefined
    ): void => {
        queryClient.setQueryData<InfiniteData<PaginatedResponse<TEntity>>>(
            keyFn(params),
            (current) => updater(current)
        );
    };

    hook.invalidate = (params: TParams): Promise<void> => {
        return queryClient.invalidateQueries({ queryKey: keyFn(params) });
    };

    hook.clear = (params: TParams): void => {
        queryClient.removeQueries({ queryKey: keyFn(params) });
    };

    return hook as InfiniteQueryHook<TParams, TEntity>;
};

// ---------------------------------------------------------------------------
// createMutation — standalone mutation factory
// ---------------------------------------------------------------------------
// const useApplyColor = createMutation(
//     (params: ApplyColorParams) => colorService.apply(params)
// );
//
// // As a hook:
// const mutation = useApplyColor({ onSuccess: () => ... });
// mutation.mutate(params);
// ---------------------------------------------------------------------------

type MutationHook<TData, TVariables> =
    (options?: MutationOptions<TData, TVariables>) => ReturnType<typeof useMutation<TData, Error, TVariables>>;

export const createMutation = <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>
): MutationHook<TData, TVariables> => {
    return (options?: MutationOptions<TData, TVariables>) => {
        return useMutation<TData, Error, TVariables>({
            ...options,
            mutationFn
        });
    };
};

// ---------------------------------------------------------------------------
// createPaginatedQuery — CRUD + list + infinite list with cache management
// ---------------------------------------------------------------------------
// Fixed: useInfiniteListQuery now uses a separate 'infinite-list' key segment
// to avoid key collision with useListQuery (they have incompatible data shapes).
// ---------------------------------------------------------------------------

interface PaginatedQueryConfig<TEntity extends WithId, TListParams, TCreateParams, TUpdateParams, TCreateResult = TEntity> {
    /** Top-level cache key */
    baseKey: string;
    defaultLimit?: number;

    service: {
        list: (params: TListParams) => Promise<PaginatedResponse<TEntity>>;
        create?: (params: TCreateParams) => Promise<TCreateResult>;
        update?: (id: string, params: TUpdateParams) => Promise<TEntity>;
        delete?: (id: string) => Promise<void>;
    };

    detailKey: (id: string) => QueryKey;

    /**
     * Extract the entity from a create result for cache patching.
     * Defaults to identity (result IS the entity).
     */
    extractEntity?: (result: TCreateResult) => TEntity;

    /**
     * Extra cache patches after upsert/remove
     */
    onUpsert?: (entity: TEntity) => void;
    onRemove?: (id: string) => void;
}

const buildPaginationFromCurrent = (current: PaginatedResponse<unknown>, shouldRemove = false) => {
    const total = shouldRemove
        ? Math.max(0, current.pagination.total - 1)
        : Math.max(0, current.pagination.total + 1);
    return {
        ...current.pagination,
        total,
        totalPages: Math.ceil(total / current.pagination.limit)
    };
};

export const createPaginatedQuery = <
    TEntity extends WithId,
    TListParams extends object = object,
    TCreateParams = void,
    TUpdateParams = Partial<TEntity>,
    TCreateResult = TEntity
>(config: PaginatedQueryConfig<TEntity, TListParams, TCreateParams, TUpdateParams, TCreateResult>) => {
    const requireService = <T>(fn: T | undefined, method: string): T => {
        if (!fn) {
            throw new Error(`[${config.baseKey}] service.${method} is not defined`);
        }
        return fn;
    };

    const QUERY_KEYS = {
        all: () => [config.baseKey],
        lists: () => [config.baseKey, 'list'],
        list: (params: TListParams) => [config.baseKey, 'list', params],
        infiniteLists: () => [config.baseKey, 'infinite-list'],
        infiniteList: (params: Omit<TListParams, 'page' | 'limit'>) => [config.baseKey, 'infinite-list', params]
    };

    const patchAllLists = (
        updater: (current: PaginatedResponse<TEntity>) => PaginatedResponse<TEntity>
    ): void => {
        queryClient.setQueriesData<PaginatedResponse<TEntity>>({
            queryKey: QUERY_KEYS.lists(),
        }, (current) => (current ? updater(current) : current));
    };

    const patchAllInfiniteLists = (
        updater: (current: InfiniteData<PaginatedResponse<TEntity>>) => InfiniteData<PaginatedResponse<TEntity>>
    ): void => {
        queryClient.setQueriesData<InfiniteData<PaginatedResponse<TEntity>>>({
            queryKey: QUERY_KEYS.infiniteLists(),
        }, (current) => (current ? updater(current) : current));
    };

    const upsert = (entity: TEntity): void => {
        // Patch flat list caches
        patchAllLists((current) => {
            const exists = current.data.some((e) => e._id === entity._id);
            const nextData = exists
                ? current.data.map((e) => (e._id === entity._id ? { ...e, ...entity } : e))
                : [entity, ...current.data].slice(0, current.pagination.limit);

            const pagination = exists
                ? current.pagination
                : buildPaginationFromCurrent(current);

            return {
                ...current,
                data: nextData,
                pagination
            };
        });

        // Patch infinite list caches
        patchAllInfiniteLists((current) => {
            let found = false;
            const pages = current.pages.map((page) => {
                const exists = page.data.some((e) => e._id === entity._id);
                if (exists) {
                    found = true;
                    return {
                        ...page,
                        data: page.data.map((e) => (e._id === entity._id ? { ...e, ...entity } : e))
                    };
                }
                return page;
            });

            if (!found && pages.length > 0) {
                const firstPage = pages[0];
                pages[0] = {
                    ...firstPage,
                    data: [entity, ...firstPage.data].slice(0, firstPage.pagination.limit),
                    pagination: buildPaginationFromCurrent(firstPage)
                };
            }

            return { ...current, pages, pageParams: current.pageParams };
        });

        // Patch detail cache
        queryClient.setQueriesData<TEntity>({
            queryKey: config.detailKey(entity._id)
        }, (current) => current?._id === entity._id ? entity : current);

        config.onUpsert?.(entity);
    };

    const remove = (id: string): void => {
        // Patch flat list caches
        patchAllLists((current) => ({
            ...current,
            data: current.data.filter((e) => e._id !== id),
            pagination: buildPaginationFromCurrent(current, true)
        }));

        // Patch infinite list caches
        patchAllInfiniteLists((current) => ({
            ...current,
            pages: current.pages.map((page) => ({
                ...page,
                data: page.data.filter((e) => e._id !== id),
                pagination: buildPaginationFromCurrent(page, true)
            })),
            pageParams: current.pageParams
        }));

        queryClient.removeQueries({
            queryKey: config.detailKey(id),
            predicate: (query) => query.queryKey[1] === id
        });

        config.onRemove?.(id);
    };

    const invalidate = (): Promise<void> => {
        return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all() });
    };

    const useListQuery = createQuery(QUERY_KEYS.list, config.service.list);

    const useInfiniteListQuery = (
        params: Omit<TListParams, 'page' | 'limit'>,
        options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>
    ) => {
        return useInfiniteQuery({
            ...options,
            queryKey: QUERY_KEYS.infiniteList(params),
            queryFn: ({ pageParam }) =>
                config.service.list({
                    ...params,
                    page: pageParam as number,
                    limit: config.defaultLimit ?? 20
                } as TListParams),
            initialPageParam: 1,
            getNextPageParam: (lastPage) =>
                lastPage.pagination.hasMore
                    ? lastPage.pagination.page + 1
                    : undefined
        });
    };

    const useCreateMutation = (options?: MutationOptions<TCreateResult, TCreateParams>) => {
        return useMutation<TCreateResult, Error, TCreateParams>({
            ...options,
            mutationFn: (params) => requireService(config.service.create, 'create')(params),
            onSuccess: withSuccess((result) => {
                const entity = config.extractEntity
                    ? config.extractEntity(result)
                    : result as unknown as TEntity;
                upsert(entity);
            }, options)
        });
    };

    const useUpdateMutation = (
        options?: MutationOptions<TEntity, UpdateVariables<TUpdateParams>>
    ) => {
        return useMutation<TEntity, Error, UpdateVariables<TUpdateParams>>({
            ...options,
            mutationFn: ({ id, params }) => requireService(config.service.update, 'update')(id, params),
            onSuccess: withSuccess((entity) => upsert(entity), options)
        });
    };

    const useDeleteMutation = (options?: MutationOptions<void, string>) => {
        return useMutation<void, Error, string>({
            ...options,
            mutationFn: (id) => requireService(config.service.delete, 'delete')(id),
            onSuccess: withSuccess((_data, id) => remove(id), options)
        });
    };

    return {
        QUERY_KEYS,
        cache: {
            upsert,
            remove,
            patchAllLists,
            patchAllInfiniteLists,
            invalidate
        },
        useListQuery,
        useCreateMutation,
        useUpdateMutation,
        useDeleteMutation,
        useInfiniteListQuery
    };
};
