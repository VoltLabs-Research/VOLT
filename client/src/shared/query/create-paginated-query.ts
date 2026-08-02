import queryClient from './query-client';
import { createInfiniteQuery } from './create-infinite-query';
import { createQuery } from './create-query';
import { withSuccess } from './create-mutation';
import { useMutation } from '@tanstack/react-query';
import type { InfinitePages, PaginationRequest } from './create-infinite-query';
import type { MutationOptions } from './create-mutation';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Identifiable } from '@/shared/contracts/entity';
import type { QueryKey } from '@tanstack/react-query';

interface UpdateVariables<TUpdateParams> {
    id: string;
    params: TUpdateParams;
};

interface PaginatedQueryConfig<
    TEntity extends Identifiable,
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

const shiftTotal = (current: PaginatedResponse<unknown>, shouldRemove = false) => {
    const total = shouldRemove
        ? Math.max(0, current.pagination.total - 1)
        : current.pagination.total + 1;

    return {
        ...current.pagination,
        total,
        totalPages: Math.ceil(total / current.pagination.limit)
    };
};

/**
 * The CRUD surface of one paginated resource: list and infinite-list hooks, the
 * three mutations, and the cache patching that keeps every cached page in step
 * with a create/update/delete without a refetch.
 */
export const createPaginatedQuery = <
    TEntity extends Identifiable,
    TListParams extends object = Record<string, never>,
    TCreateParams = void,
    TUpdateParams = Partial<TEntity>,
    TCreateResult extends TEntity = TEntity
>(config: PaginatedQueryConfig<TEntity, TListParams, TCreateParams, TUpdateParams, TCreateResult>) => {
    // Every hook is returned regardless of which service methods the resource
    // declares, so a missing one can only be caught when it is actually called.
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
        updater: (current: InfinitePages<TEntity>) => InfinitePages<TEntity>
    ): void => {
        queryClient.setQueriesData<InfinitePages<TEntity>>({
            queryKey: QUERY_KEYS.infiniteLists()
        }, (current) => current?.pages ? updater(current) : current);
    };

    const clearDetailCache = (id: string): void => {
        queryClient.removeQueries({
            queryKey: config.detailKey(id),
            predicate: (query) => query.queryKey[1] === id
        });
    };

    const upsert = (entity: TEntity): void => {
        patchAllLists((current) => {
            const exists = current.data.some((currentEntity) => currentEntity._id === entity._id);
            const nextData = exists
                ? current.data.map((currentEntity) => currentEntity._id === entity._id ? {
                    ...currentEntity,
                    ...entity
                } : currentEntity)
                : [entity, ...current.data].slice(0, current.pagination.limit);

            return {
                ...current,
                data: nextData,
                pagination: exists ? current.pagination : shiftTotal(current)
            };
        });

        patchAllInfiniteLists((current) => {
            let found = false;
            const pages = current.pages.map((page) => {
                if (!page.data.some((currentEntity) => currentEntity._id === entity._id)) {
                    return page;
                }

                found = true;
                return {
                    ...page,
                    data: page.data.map((currentEntity) => currentEntity._id === entity._id ? {
                        ...currentEntity,
                        ...entity
                    } : currentEntity)
                };
            });

            if (!found && pages.length > 0) {
                const firstPage = pages[0];
                pages[0] = {
                    ...firstPage,
                    data: [entity, ...firstPage.data].slice(0, firstPage.pagination.limit),
                    pagination: shiftTotal(firstPage)
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
            pagination: shiftTotal(current, true)
        }));

        patchAllInfiniteLists((current) => ({
            ...current,
            pages: current.pages.map((page) => ({
                ...page,
                data: page.data.filter((entity) => entity._id !== id),
                pagination: shiftTotal(page, true)
            })),
            pageParams: current.pageParams
        }));

        clearDetailCache(id);
        config.onRemove?.(id);
    };

    const invalidateListings = (): Promise<void[]> => {
        return Promise.all([
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() }),
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.infiniteLists() })
        ]);
    };

    /** Shared tail of create and update: the entity is already the server's answer. */
    const acceptEntity = (entity: TEntity): void => {
        queryClient.setQueryData<TEntity>(config.detailKey(entity._id), entity);
        void invalidateListings();
        config.onUpsert?.(entity);
    };

    const useCreateMutation = (options?: MutationOptions<TCreateResult, TCreateParams>) => {
        return useMutation<TCreateResult, Error, TCreateParams>({
            ...options,
            mutationFn: (params) => requireService(config.service.create, 'create')(params),
            onSuccess: withSuccess((result) => {
                acceptEntity(config.extractEntity ? config.extractEntity(result) : result);
            }, options)
        });
    };

    const useUpdateMutation = (options?: MutationOptions<TEntity, UpdateVariables<TUpdateParams>>) => {
        return useMutation<TEntity, Error, UpdateVariables<TUpdateParams>>({
            ...options,
            mutationFn: ({ id, params }) => requireService(config.service.update, 'update')(id, params),
            onSuccess: withSuccess(acceptEntity, options)
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
            invalidate: (): Promise<void> => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all() })
        },
        useListQuery: createQuery(QUERY_KEYS.list, config.service.list),
        useCreateMutation,
        useUpdateMutation,
        useDeleteMutation,
        useInfiniteListQuery: createInfiniteQuery<TListParams, TEntity>(
            QUERY_KEYS.infiniteList,
            (params, pagination) => config.service.list({
                ...params,
                ...pagination
            }),
            { defaultLimit: config.defaultLimit }
        )
    };
};
