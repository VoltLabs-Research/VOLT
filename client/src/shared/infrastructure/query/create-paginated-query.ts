import queryClient from './query-client';
import { skipToken, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { FetchQueryOptions, InfiniteData, QueryKey, UseInfiniteQueryOptions, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { MutationFunctionContext } from '@tanstack/react-query';

export type QueryOptions<TData> = Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>;

export type MutationOptions<TData, TVariables> = Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn'
>;

export type InfiniteQueryOptions<TData> = Omit<
    UseInfiniteQueryOptions<TData, Error, InfiniteData<TData, number>, QueryKey, number>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

type UpdateVariables<TUpdateParams> = {
    id: string;
    params: TUpdateParams;
};

type KeyFnMap<T extends object> = {
    [K in keyof T]: T[K] extends void
        ? (params?: void) => QueryKey
        : (() => QueryKey) & ((params: T[K]) => QueryKey);
} & {
    prefix: () => QueryKey;
};

type QueryHook<TParams, TData> =
    ((params: TParams, options?: QueryOptions<TData>) => ReturnType<typeof useQuery<TData>>)
    & QueryHookStatics<TParams, TData>;

type SocketQueryHook<TParams, TData> =
    ((params: TParams, options?: QueryOptions<TData>) => ReturnType<typeof useQuery<TData>>)
    & SocketQueryStatics<TParams, TData>;

type InfiniteQueryHook<TParams, TEntity> =
    ((
        params: TParams,
        options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>
    ) => ReturnType<typeof useInfiniteQuery<
        PaginatedResponse<TEntity>,
        Error,
        InfiniteData<PaginatedResponse<TEntity>, number>,
        QueryKey,
        number
    >>)
    & InfiniteQueryStatics<TParams, TEntity>;

type MutationHook<TData, TVariables> =
    (options?: MutationOptions<TData, TVariables>) => ReturnType<typeof useMutation<TData, Error, TVariables>>;

interface WithId {
    _id: string;
};

interface PaginationRequest {
    page: number;
    limit: number;
};

interface SocketQueryConfig<TData> {
    initialData?: TData;
};

interface InfiniteQueryConfig {
    defaultLimit?: number;
};

interface WithSuccessOptions<TData, TVariables, TOnMutateResult = unknown> {
    onSuccess?: (
        data: TData,
        variables: TVariables,
        onMutateResult: TOnMutateResult,
        context: MutationFunctionContext
    ) => unknown;
};

type MutationInvalidationKeys<TData, TVariables, TOnMutateResult = unknown> =
    QueryKey[]
    | ((
        data: TData,
        variables: TVariables,
        onMutateResult: TOnMutateResult,
        context: MutationFunctionContext
    ) => QueryKey[]);

interface QueryBuildOptions<TData> {
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
};

interface QueryHookStatics<TParams, TData> {
    set: (params: TParams, data: TData) => void;
    fetch: (params: TParams, options?: Omit<FetchQueryOptions<TData>, 'queryKey' | 'queryFn'>) => Promise<TData>;
    invalidate: (params: TParams) => Promise<void>;
    clear: (params: TParams) => void;
    buildOptions: (params: TParams) => QueryBuildOptions<TData>;
};

interface SocketQueryStatics<TParams, TData> {
    set: (params: TParams, data: TData) => void;
    get: (params: TParams) => TData | undefined;
    update: (params: TParams, updater: (current: TData | undefined) => TData) => void;
    reset: (params: TParams) => void;
};

interface InfiniteQueryStatics<TParams, TEntity> {
    setData: (
        params: TParams,
        updater: (current: InfiniteData<PaginatedResponse<TEntity>, number> | undefined) => InfiniteData<PaginatedResponse<TEntity>, number> | undefined
    ) => void;
    invalidate: (params: TParams) => Promise<void>;
    clear: (params: TParams) => void;
};

interface PaginatedQueryConfig<
    TEntity extends WithId,
    TListParams extends object,
    TCreateParams,
    TUpdateParams,
    TCreateResult extends TEntity = TEntity
> {
    baseKey: string;
    defaultLimit?: number;
    service: {
        list: (params: TListParams & PaginationRequest) => Promise<PaginatedResponse<TEntity>>;
        create?: (params: TCreateParams) => Promise<TCreateResult>;
        update?: (id: string, params: TUpdateParams) => Promise<TEntity>;
        delete?: (id: string) => Promise<void>;
    };
    detailKey: (id: string) => QueryKey;
    extractEntity?: (result: TCreateResult) => TEntity;
    onUpsert?: (entity: TEntity) => void;
    onRemove?: (id: string) => void;
};

/** Builds typed query keys with optional void params support. */
export function buildKeys<T extends object>(base: string | readonly string[]): KeyFnMap<T>;
export function buildKeys(base: string | readonly string[]) {
    const baseSegments = typeof base === 'string' ? [base] : [...base];
    const target = {
        prefix: () => [...baseSegments]
    };

    return new Proxy(target, {
        get: (_, key: string) => {
            if (key === 'prefix') {
                return () => [...baseSegments];
            }

            return (params: unknown) => {
                if (params === undefined || params === null) {
                    return [...baseSegments, key];
                }

                return [...baseSegments, key, params];
            };
        }
    });
};

/** Composes internal mutation success handlers with consumer callbacks. */
export const withSuccess = <TData, TVariables, TOnMutateResult = unknown>(
    handler: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void,
    options?: WithSuccessOptions<TData, TVariables, TOnMutateResult>
): ((data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void) => {
    return (data, variables, onMutateResult, context) => {
        handler(data, variables, onMutateResult, context);
        options?.onSuccess?.(data, variables, onMutateResult, context);
    };
};

/** Creates a standard query hook with cache helpers. */
export const createQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    queryFn: (params: TParams) => Promise<TData>
): QueryHook<TParams, TData> => {
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

/** Creates a socket-backed query hook that never fetches on its own. */
export const createSocketQuery = <TParams, TData>(
    keyFn: (params: TParams) => QueryKey,
    config?: SocketQueryConfig<TData>
): SocketQueryHook<TParams, TData> => {
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

/** Creates an infinite query hook with pagination helpers. */
export const createInfiniteQuery = <TParams, TEntity>(
    keyFn: (params: TParams) => QueryKey,
    fetchPage: (params: TParams, pagination: PaginationRequest) => Promise<PaginatedResponse<TEntity>>,
    config?: InfiniteQueryConfig
): InfiniteQueryHook<TParams, TEntity> => {
    const limit = config?.defaultLimit ?? 20;

    return Object.assign(
        (params: TParams, options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>) => useInfiniteQuery<
            PaginatedResponse<TEntity>,
            Error,
            InfiniteData<PaginatedResponse<TEntity>, number>,
            QueryKey,
            number
        >({
            ...options,
            queryKey: keyFn(params),
            queryFn: ({ pageParam }) => fetchPage(params, { page: pageParam, limit }),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined
        }),
        {
            setData(
                params: TParams,
                updater: (current: InfiniteData<PaginatedResponse<TEntity>, number> | undefined) => InfiniteData<PaginatedResponse<TEntity>, number> | undefined
            ): void {
                queryClient.setQueryData<InfiniteData<PaginatedResponse<TEntity>, number>>(keyFn(params), updater);
            },
            invalidate(params: TParams): Promise<void> {
                return queryClient.invalidateQueries({ queryKey: keyFn(params) });
            },
            clear(params: TParams): void {
                queryClient.removeQueries({ queryKey: keyFn(params) });
            }
        }
    );
};

/** Creates a mutation hook factory with shared typing. */
export const createMutation = <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    onSuccess?: (data: TData, variables: TVariables, onMutateResult: unknown, context: MutationFunctionContext) => unknown
): MutationHook<TData, TVariables> => {
    return (options?: MutationOptions<TData, TVariables>) => useMutation<TData, Error, TVariables>({
        ...options,
        mutationFn,
        onSuccess: onSuccess
            ? withSuccess((data, variables, onMutateResult, context) => {
                void onSuccess(data, variables, onMutateResult, context);
            }, options)
            : options?.onSuccess
    });
};

export const createInvalidatingMutation = <TData, TVariables, TOnMutateResult = unknown>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    invalidationKeys: MutationInvalidationKeys<TData, TVariables, TOnMutateResult>,
    onSuccess?: (
        data: TData,
        variables: TVariables,
        onMutateResult: TOnMutateResult,
        context: MutationFunctionContext
    ) => unknown
): MutationHook<TData, TVariables> => {
    return createMutation<TData, TVariables>(mutationFn, async (data, variables, onMutateResult, context) => {
        const keys = typeof invalidationKeys === 'function'
            ? invalidationKeys(data, variables, onMutateResult as TOnMutateResult, context)
            : invalidationKeys;

        await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        await onSuccess?.(data, variables, onMutateResult as TOnMutateResult, context);
    });
};

const withPaginationParams = <TParams extends object>(params: TParams, pagination: PaginationRequest): TParams & PaginationRequest => {
    return {
        ...params,
        ...pagination
    };
};

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

/** Creates list and CRUD hooks with shared cache maintenance. */
export const createPaginatedQuery = <
    TEntity extends WithId,
    TListParams extends object = Record<string, never>,
    TCreateParams = void,
    TUpdateParams = Partial<TEntity>,
    TCreateResult extends TEntity = TEntity
>(config: PaginatedQueryConfig<TEntity, TListParams, TCreateParams, TUpdateParams, TCreateResult>) => {
    const requireService = <T,>(fn: T | undefined, method: string): T => {
        if (!fn) {
            throw new Error(`[${config.baseKey}] service.${method} is not defined`);
        }

        return fn;
    };

    const QUERY_KEYS = {
        all: () => [config.baseKey],
        lists: () => [config.baseKey, 'list'],
        list: (params: TListParams & PaginationRequest) => [config.baseKey, 'list', params],
        infiniteLists: () => [config.baseKey, 'infinite-list'],
        infiniteList: (params: TListParams) => [config.baseKey, 'infinite-list', params]
    };

    const patchAllLists = (updater: (current: PaginatedResponse<TEntity>) => PaginatedResponse<TEntity>): void => {
        queryClient.setQueriesData<PaginatedResponse<TEntity>>({
            queryKey: QUERY_KEYS.lists()
        }, (current) => current?.data ? updater(current) : current);
    };

    const patchAllInfiniteLists = (
        updater: (current: InfiniteData<PaginatedResponse<TEntity>, number>) => InfiniteData<PaginatedResponse<TEntity>, number>
    ): void => {
        queryClient.setQueriesData<InfiniteData<PaginatedResponse<TEntity>, number>>({
            queryKey: QUERY_KEYS.infiniteLists()
        }, (current) => current?.pages ? updater(current) : current);
    };

    const upsert = (entity: TEntity): void => {
        patchAllLists((current) => {
            const exists = current.data.some((currentEntity) => currentEntity._id === entity._id);
            const nextData = exists
                ? current.data.map((currentEntity) => currentEntity._id === entity._id ? { ...currentEntity, ...entity } : currentEntity)
                : [entity, ...current.data].slice(0, current.pagination.limit);

            return {
                ...current,
                data: nextData,
                pagination: exists ? current.pagination : buildPaginationFromCurrent(current)
            };
        });

        patchAllInfiniteLists((current) => {
            let found = false;
            const pages = current.pages.map((page) => {
                const exists = page.data.some((currentEntity) => currentEntity._id === entity._id);
                if (!exists) {
                    return page;
                }

                found = true;
                return {
                    ...page,
                    data: page.data.map((currentEntity) => currentEntity._id === entity._id ? { ...currentEntity, ...entity } : currentEntity)
                };
            });

            if (!found && pages.length > 0) {
                const firstPage = pages[0];
                pages[0] = {
                    ...firstPage,
                    data: [entity, ...firstPage.data].slice(0, firstPage.pagination.limit),
                    pagination: buildPaginationFromCurrent(firstPage)
                };
            }

            return {
                ...current,
                pages,
                pageParams: current.pageParams
            };
        });

        queryClient.setQueriesData<TEntity>({
            queryKey: config.detailKey(entity._id)
        }, (current) => current?._id === entity._id ? entity : current);

        config.onUpsert?.(entity);
    };

    const remove = (id: string): void => {
        patchAllLists((current) => ({
            ...current,
            data: current.data.filter((entity) => entity._id !== id),
            pagination: buildPaginationFromCurrent(current, true)
        }));

        patchAllInfiniteLists((current) => ({
            ...current,
            pages: current.pages.map((page) => ({
                ...page,
                data: page.data.filter((entity) => entity._id !== id),
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

    const invalidateListings = (): Promise<void[]> => {
        return Promise.all([
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() }),
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.infiniteLists() })
        ]);
    };

    const syncDetailCache = (entity: TEntity): void => {
        queryClient.setQueryData<TEntity>(config.detailKey(entity._id), entity);
    };

    const clearDetailCache = (id: string): void => {
        queryClient.removeQueries({
            queryKey: config.detailKey(id),
            predicate: (query) => query.queryKey[1] === id
        });
    };

    const useListQuery = createQuery(QUERY_KEYS.list, config.service.list);

    const useInfiniteListQuery = (
        params: TListParams,
        options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>
    ) => {
        return useInfiniteQuery<
            PaginatedResponse<TEntity>,
            Error,
            InfiniteData<PaginatedResponse<TEntity>, number>,
            QueryKey,
            number
        >({
            ...options,
            queryKey: QUERY_KEYS.infiniteList(params),
            queryFn: ({ pageParam }) => config.service.list(withPaginationParams(params, {
                page: pageParam,
                limit: config.defaultLimit ?? 20
            })),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined
        });
    };

    const useCreateMutation = (options?: MutationOptions<TCreateResult, TCreateParams>) => {
        return useMutation<TCreateResult, Error, TCreateParams>({
            ...options,
            mutationFn: (params) => requireService(config.service.create, 'create')(params),
            onSuccess: withSuccess((result) => {
                const entity = config.extractEntity ? config.extractEntity(result) : result;
                syncDetailCache(entity);
                void invalidateListings();
                config.onUpsert?.(entity);
            }, options)
        });
    };

    const useUpdateMutation = (options?: MutationOptions<TEntity, UpdateVariables<TUpdateParams>>) => {
        return useMutation<TEntity, Error, UpdateVariables<TUpdateParams>>({
            ...options,
            mutationFn: ({ id, params }) => requireService(config.service.update, 'update')(id, params),
            onSuccess: withSuccess((entity) => {
                syncDetailCache(entity);
                void invalidateListings();
                config.onUpsert?.(entity);
            }, options)
        });
    };

    const useDeleteMutation = (options?: MutationOptions<void, string>) => {
        return useMutation<void, Error, string>({
            ...options,
            mutationFn: (id) => requireService(config.service.delete, 'delete')(id),
            onSuccess: withSuccess((_data, id) => {
                clearDetailCache(id);
                void invalidateListings();
                config.onRemove?.(id);
            }, options)
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
