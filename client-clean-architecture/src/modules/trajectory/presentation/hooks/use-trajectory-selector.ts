import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import useTrajectoryStore from '../stores/use-trajectory-store';
import useGetTrajectories from './trajectory/use-get-trajectories';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { Trajectory } from '../../domain/entities';

export interface UseTrajectorySelectorOptions {
    allowEmpty?: boolean;
    emptyLabel?: string;
};

export interface UseTrajectorySelectorReturn {
    options: SelectOption[];
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => void;
};

const DEFAULT_LIMIT = 20;

const useTrajectorySelector = (options: UseTrajectorySelectorOptions = {}): UseTrajectorySelectorReturn => {
    const { allowEmpty = false, emptyLabel = 'All Trajectories' } = options;

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);
    const appendTrajectories = useTrajectoryStore((state) => state.appendTrajectories);

    const getTrajectories = useGetTrajectories();

    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const initialFetchDone = useRef(false);

    const fetchTrajectories = useCallback(async (pageNum: number, append: boolean) => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const response = await getTrajectories({
                page: pageNum,
                limit: DEFAULT_LIMIT
            });

            if (append) {
                appendTrajectories(response.data);
            } else {
                setTrajectories(response.data);
            }

            setHasMore(response.pagination.hasMore);
            setPage(pageNum);
        } catch (error) {
            console.error('Failed to fetch trajectories:', error);
        } finally {
            setIsLoading(false);
        }
    }, [getTrajectories, setTrajectories, appendTrajectories, isLoading]);

    useEffect(() => {
        if (initialFetchDone.current) return;
        if (trajectories.length > 0) {
            initialFetchDone.current = true;
            return;
        }

        initialFetchDone.current = true;
        fetchTrajectories(1, false);
    }, []);

    const loadMore = useCallback(() => {
        if (!isLoading && hasMore) {
            fetchTrajectories(page + 1, true);
        }
    }, [isLoading, hasMore, page, fetchTrajectories]);

    const selectOptions = useMemo((): SelectOption[] => {
        const opts: SelectOption[] = [];

        if (allowEmpty) {
            opts.push({ value: '', title: emptyLabel });
        }

        trajectories.forEach((trajectory: Trajectory) => {
            opts.push({
                value: trajectory._id,
                title: trajectory.name
            });
        });

        return opts;
    }, [trajectories, allowEmpty, emptyLabel]);

    return {
        options: selectOptions,
        isLoading,
        hasMore,
        loadMore
    };
};

export default useTrajectorySelector;
