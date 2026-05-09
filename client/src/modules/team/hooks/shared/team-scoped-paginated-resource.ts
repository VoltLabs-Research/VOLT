import { buildKeys, queryClient } from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { QueryKey } from '@tanstack/react-query';

interface TeamScopedPaginatedParams {
    teamId: string;
    page: number;
    limit: number;
}

interface TeamScopedAggregateParams {
    teamId: string;
    limit: number;
}

interface TeamScopedListingParams {
    page: number;
    limit: number;
}

interface TeamScopedPaginatedResourceConfig<TKeyName extends string, TEntity extends { _id: string }> {
    baseKey: string;
    listKeyName: TKeyName;
    list: (params: TeamScopedPaginatedParams) => Promise<PaginatedResponse<TEntity>>;
}

interface TeamScopedListingAccessors<TEntity, TListParams extends TeamScopedListingParams> {
    queryKey: QueryKey;
    fetchData: (params: TListParams) => Promise<PaginatedResponse<TEntity>>;
}

export const createTeamScopedPaginatedResource = <
    TKeyName extends string,
    TEntity extends { _id: string }
>(config: TeamScopedPaginatedResourceConfig<TKeyName, TEntity>) => {
    const queryKeys = buildKeys<{ [K in TKeyName]: void }>(config.baseKey);

    const getListingQueryKey = ({ teamId }: { teamId: string }): QueryKey => {
        return [...queryKeys[config.listKeyName](), teamId];
    };

    const getPageQueryKey = ({ teamId, page, limit }: TeamScopedPaginatedParams): QueryKey => {
        return [...getListingQueryKey({ teamId }), {
            page,
            limit
        }];
    };

    const getAggregateQueryKey = ({ teamId, limit }: TeamScopedAggregateParams): QueryKey => {
        return [...getListingQueryKey({ teamId }), {
            aggregate: true,
            limit
        }];
    };

    const fetchAllPages = async ({ teamId, limit }: TeamScopedAggregateParams): Promise<TEntity[]> => {
        const items: TEntity[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await config.list({
                teamId,
                page,
                limit
            });

            items.push(...response.data);
            hasMore = response.pagination.hasMore;
            page = response.pagination.page + 1;
        }

        return items;
    };

    const createListingAccessors = <TListParams extends TeamScopedListingParams = TeamScopedListingParams>(
        teamId?: string | null
    ): TeamScopedListingAccessors<TEntity, TListParams> => {
        return {
            queryKey: teamId ? getListingQueryKey({ teamId }) : queryKeys[config.listKeyName](),
            fetchData: async (params: TListParams): Promise<PaginatedResponse<TEntity>> => {
                if (!teamId) {
                    throw new Error('No team selected');
                }

                return config.list({
                    teamId,
                    ...params
                });
            }
        };
    };

    return {
        queryKeys,
        getListingQueryKey,
        getPageQueryKey,
        getAggregateQueryKey,
        invalidateListingQuery: (teamId: string) => queryClient.invalidateQueries({ queryKey: getListingQueryKey({ teamId }) }),
        fetchAllPages,
        createListingAccessors
    };
};
