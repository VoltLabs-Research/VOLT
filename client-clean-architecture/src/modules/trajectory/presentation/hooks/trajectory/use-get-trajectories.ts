import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { calculatePaginationState } from '@/shared/utils/calculate-pagination-state';

interface GetTrajectoriesParams {
    page?: number;
    limit?: number;
    search?: string;
    append?: boolean;
};

const useGetTrajectories = () => {
    const { getTrajectoriesUseCase } = useTrajectoryUseCases();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const listingMeta = useTrajectoryStore((state) => state.listingMeta);
    const setLoading = useTrajectoryStore((state) => state.setLoading);
    const setError = useTrajectoryStore((state) => state.setError);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);

    const getTrajectories = useCallback(async (params: GetTrajectoriesParams = {}) => {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;
        const isAppending = params.append ?? false;

        setLoading(isAppending ? 'more' : 'list', true);
        setError(null);

        try {
            const result = await getTrajectoriesUseCase.execute({
                page,
                limit,
                search: params.search
            });

            const paginationResult = calculatePaginationState({
                newData: result.trajectories,
                currentData: trajectories,
                page,
                limit,
                append: isAppending,
                totalFromApi: result.total,
                previousTotal: listingMeta.total
            });

            setTrajectories(paginationResult.data, paginationResult.listingMeta);
        } catch(error) {
            setError(error instanceof Error ? error.message : 'Failed to fetch trajectories');
        } finally {
            setLoading(isAppending ? 'more' : 'list', false);
        }
    }, [getTrajectoriesUseCase, trajectories, listingMeta.total, setLoading, setError, setTrajectories]);

    return getTrajectories;
};

export default useGetTrajectories;
