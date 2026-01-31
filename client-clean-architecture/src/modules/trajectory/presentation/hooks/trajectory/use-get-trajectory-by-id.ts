import { useCallback, useEffect } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { Trajectory } from '@/modules/trajectory/domain/entities';

interface UseGetTrajectoryByIdParams{
    trajectoryId?: string;
    enabled?: boolean;
};

interface UseGetTrajectoryByIdResult{
    trajectory: Trajectory | null;
    isLoading: boolean;
    error: string | null;
    isReady: boolean;
    refetch: () => Promise<void>;
};

const useGetTrajectoryById = (params: UseGetTrajectoryByIdParams = {}): UseGetTrajectoryByIdResult => {
    const { trajectoryId, enabled = true } = params;
    
    const { getTrajectoryByIdUseCase } = useTrajectoryUseCases();
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoading = useTrajectoryStore((state) => state.isLoadingSingle);
    const error = useTrajectoryStore((state) => state.error);
    const setLoading = useTrajectoryStore((state) => state.setLoading);
    const setError = useTrajectoryStore((state) => state.setError);
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);

    const fetchTrajectory = useCallback(async () => {
        if(!trajectoryId) return;
        
        setLoading('single', true);
        setError(null);

        try{
            const result = await getTrajectoryByIdUseCase.execute(trajectoryId);
            setTrajectory(result);
        }catch(err){
            setError(err instanceof Error ? err.message : 'Failed to fetch trajectory');
        }finally{
            setLoading('single', false);
        }
    }, [trajectoryId, getTrajectoryByIdUseCase, setLoading, setError, setTrajectory]);

    useEffect(() => {
        if(!enabled || !trajectoryId) return;
        if(trajectory?._id === trajectoryId) return;
        fetchTrajectory();
    }, [trajectoryId, enabled, trajectory?._id, fetchTrajectory]);

    return {
        trajectory,
        isLoading,
        error,
        isReady: !!trajectory && trajectory._id === trajectoryId && !isLoading,
        refetch: fetchTrajectory
    };
};

export default useGetTrajectoryById;
