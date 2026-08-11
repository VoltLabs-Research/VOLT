import { useTrajectoriesInfiniteQuery } from './queries';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface TrajectorySelectOption {
    value: string;
    title: string;
    description?: string;
};

interface UseTrajectorySelectorOptions {
    allowEmpty?: boolean;
    emptyLabel?: string;
}

interface UseTrajectorySelectorReturn {
    options: TrajectorySelectOption[];
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
    } = useTrajectoriesInfiniteQuery({
        page: 1,
        limit: DEFAULT_LIMIT
    });

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

    const selectOptions = useMemo((): TrajectorySelectOption[] => {
        const result: TrajectorySelectOption[] = [];

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
