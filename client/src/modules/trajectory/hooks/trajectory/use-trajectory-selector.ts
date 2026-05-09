import { useTrajectoriesInfiniteQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo } from 'react';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Trajectory } from '../../api/entities/trajectory/trajectory';

export interface UseTrajectorySelectorOptions {
    allowEmpty?: boolean;
    emptyLabel?: string;
}

export interface UseTrajectorySelectorReturn {
    options: SelectOption[];
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => void;
}

const DEFAULT_LIMIT = 20;

export default function useTrajectorySelector(options: UseTrajectorySelectorOptions = {}): UseTrajectorySelectorReturn {
    const { allowEmpty = false, emptyLabel = 'All Trajectories' } = options;
    const { checkAccessDeniedError } = useAccessDenied();

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        error
    } = useTrajectoriesInfiniteQuery(
        {
            page: 1,
            limit: DEFAULT_LIMIT
        },
        {
            getNextPageParam: (lastPage: PaginatedResponse<Trajectory>) => {
                if (lastPage.pagination.hasMore) {
                    return lastPage.pagination.page + 1;
                }
                return undefined;
            }
        }
    );

    useEffect(() => {
        if (error && !checkAccessDeniedError(error)) {
            sileo.error({ title: 'Failed to load trajectories' });
        }
    }, [error, checkAccessDeniedError]);

    const allTrajectories = useMemo((): Trajectory[] => {
        if (!data) {
            return [];
        }
        return data.pages.flatMap((page) => page.data);
    }, [data]);

    const hasMore = hasNextPage ?? false;

    const loadMore = useCallback(() => {
        if (!isLoading && !isFetchingNextPage && hasMore) {
            fetchNextPage();
        }
    }, [isLoading, isFetchingNextPage, hasMore, fetchNextPage]);

    const selectOptions = useMemo((): SelectOption[] => {
        const result: SelectOption[] = [];

        if (allowEmpty) {
            result.push({
                value: '',
                title: emptyLabel
            });
        }

        allTrajectories.forEach((trajectory: Trajectory) => {
            result.push({
                value: trajectory._id,
                title: trajectory.name
            });
        });

        return result;
    }, [allTrajectories, allowEmpty, emptyLabel]);

    return {
        options: selectOptions,
        isLoading: isLoading || isFetchingNextPage,
        hasMore,
        loadMore
    };
}
