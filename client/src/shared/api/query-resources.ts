import { queryClient } from '@/shared/infrastructure/query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

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
