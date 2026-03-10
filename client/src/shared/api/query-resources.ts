import type { MutationFunctionContext } from '@tanstack/query-core';
import { useMutation, type QueryClient, type QueryKey } from '@tanstack/react-query';
import {
    createQuery,
    queryClient,
    withSuccess,
    type MutationOptions
} from '@/shared/infrastructure/query';

interface QueryResourceConfig<TParams, TKeyParam, TData> {
    baseKey: string | readonly string[];
    rootKey: string;
    itemKey: string;
    getKeyParam: (params: TParams) => TKeyParam;
    query: (params: TParams) => Promise<TData>;
};

interface InvalidatingMutationConfig<TData, TVariables> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess: (
        data: TData,
        variables: TVariables,
        onMutateResult: unknown,
        context: MutationFunctionContext
    ) => unknown;
};

interface EntityCacheResourceConfig<TEntity extends { _id: string }> {
    listKey: () => QueryKey;
    detailKey: (id: string) => QueryKey;
    rootKey?: () => QueryKey;
    onUpsert?: (entity: TEntity) => void;
    onRemove?: (id: string) => void;
};

interface EntityCacheUpsertOptions {
    client?: QueryClient;
    replaceExisting?: boolean;
};

const buildQueryKey = (baseKey: string | readonly string[], segment: string, value?: unknown): QueryKey => {
    const key = typeof baseKey === 'string' ? [baseKey, segment] : [...baseKey, segment];

    return value === undefined ? key : [...key, value];
};

const resolveQueryClient = (client?: QueryClient): QueryClient => client ?? queryClient;

const upsertEntityInArray = <TEntity extends { _id: string }>(
    current: TEntity[] | undefined,
    entity: TEntity,
    replaceExisting: boolean
): TEntity[] => {
    if (!current) {
        return [entity];
    }

    const entityExists = current.some((currentEntity) => currentEntity._id === entity._id);

    if (!entityExists) {
        return [entity, ...current];
    }

    if (!replaceExisting) {
        return current;
    }

    return current.map((currentEntity) => currentEntity._id === entity._id ? entity : currentEntity);
};

export const createQueryResource = <TParams, TKeyParam, TData>(config: QueryResourceConfig<TParams, TKeyParam, TData>) => {
    const root = (): QueryKey => buildQueryKey(config.baseKey, config.rootKey);
    const item = (keyParam: TKeyParam): QueryKey => buildQueryKey(config.baseKey, config.itemKey, keyParam);
    const query = createQuery((params: TParams) => item(config.getKeyParam(params)), config.query);

    return {
        keys: {
            root,
            item
        },
        query,
        invalidate: (keyParam: TKeyParam) => queryClient.invalidateQueries({ queryKey: item(keyParam) }),
        invalidateRoot: () => queryClient.invalidateQueries({ queryKey: root() })
    };
};

export const createEntityCacheResource = <TEntity extends { _id: string }>(config: EntityCacheResourceConfig<TEntity>) => {
    return {
        upsert: (entity: TEntity, options?: EntityCacheUpsertOptions): void => {
            const activeQueryClient = resolveQueryClient(options?.client);

            activeQueryClient.setQueryData<TEntity[]>(config.listKey(), (current) => upsertEntityInArray(
                current,
                entity,
                options?.replaceExisting ?? true
            ));
            activeQueryClient.setQueryData(config.detailKey(entity._id), entity);

            config.onUpsert?.(entity);
        },
        merge: (id: string, updates: Partial<TEntity>, client?: QueryClient): void => {
            const activeQueryClient = resolveQueryClient(client);

            activeQueryClient.setQueryData<TEntity[]>(config.listKey(), (current) => {
                if (!current) {
                    return current;
                }

                return current.map((entity) => entity._id === id ? { ...entity, ...updates } : entity);
            });
            activeQueryClient.setQueryData<TEntity | undefined>(config.detailKey(id), (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    ...updates
                };
            });
        },
        remove: (id: string, client?: QueryClient): void => {
            const activeQueryClient = resolveQueryClient(client);

            activeQueryClient.setQueryData<TEntity[]>(config.listKey(), (current) => current?.filter((entity) => entity._id !== id) ?? current);
            activeQueryClient.removeQueries({ queryKey: config.detailKey(id) });

            config.onRemove?.(id);
        },
        invalidateList: (client?: QueryClient) => resolveQueryClient(client).invalidateQueries({ queryKey: config.listKey() }),
        invalidateDetail: (id: string, client?: QueryClient) => resolveQueryClient(client).invalidateQueries({ queryKey: config.detailKey(id) }),
        clearRoot: (client?: QueryClient): void => {
            const activeQueryClient = resolveQueryClient(client);
            const queryKey = config.rootKey?.() ?? config.listKey();

            activeQueryClient.removeQueries({ queryKey });
        }
    };
};

export const createInvalidatingMutation = <TData, TVariables>(config: InvalidatingMutationConfig<TData, TVariables>) => {
    return (options?: MutationOptions<TData, TVariables>) => useMutation<TData, Error, TVariables>({
        ...options,
        mutationFn: config.mutationFn,
        onSuccess: withSuccess(config.onSuccess, options)
    });
};
