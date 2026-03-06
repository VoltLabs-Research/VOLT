import { useCallback, useEffect, useRef } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-services';
import useAnalysisStore from '@/modules/analysis/presentation/stores/use-analysis-store';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
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
    accessDenied: boolean;
    accessDeniedMessage: string | undefined;
    refetch: () => Promise<void>;
};

const useGetTrajectoryById = (params: UseGetTrajectoryByIdParams = {}): UseGetTrajectoryByIdResult => {
    const { trajectoryId, enabled = true } = params;
    
    const { trajectoryRepository } = useTrajectoryUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const error = useTrajectoryStore((state) => state.error);
    const setLoading = useTrajectoryStore((state) => state.setLoading);
    const setError = useTrajectoryStore((state) => state.setError);
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);
    const resetAnalyses = useAnalysisStore((state) => state.reset);
    const activeRequestIdRef = useRef(0);

    const runFetch = useCallback(async (
        requestedTrajectoryId: string,
        requestId: number,
        isCancelled: () => boolean
    ): Promise<void> => {
        try{
            const result = await trajectoryRepository.getById(requestedTrajectoryId);

            if(isCancelled() || requestId !== activeRequestIdRef.current){
                return;
            }

            setTrajectory(result);
        }catch(err){
            if(isCancelled() || requestId !== activeRequestIdRef.current){
                return;
            }

            if(checkRBACError(err)){
                return;
            }

            if(err instanceof Error){
                setError(err.message);
            }else{
                setError('Failed to fetch trajectory');
            }
        }finally{
            if(isCancelled() || requestId !== activeRequestIdRef.current){
                return;
            }

            setLoading(false);
        }
    }, [trajectoryRepository, setTrajectory, checkRBACError, setError, setLoading]);

    const fetchTrajectory = useCallback(async () => {
        if(!trajectoryId) return;

        const requestId = activeRequestIdRef.current + 1;
        activeRequestIdRef.current = requestId;
        setLoading(true);
        setError(null);
        await runFetch(trajectoryId, requestId, () => false);
    }, [trajectoryId, setLoading, setError, runFetch]);

    useEffect(() => {
        if(!enabled){
            activeRequestIdRef.current += 1;
            return;
        }

        if(!trajectoryId){
            activeRequestIdRef.current += 1;
            setTrajectory(null);
            setError(null);
            setLoading(false);
            resetAnalyses();
            return;
        }

        const requestId = activeRequestIdRef.current + 1;
        activeRequestIdRef.current = requestId;

        let isCancelled = false;

        resetAnalyses();
        setTrajectory(null);
        setError(null);
        setLoading(true);

        void runFetch(trajectoryId, requestId, () => isCancelled);

        return () => {
            isCancelled = true;
            activeRequestIdRef.current += 1;
        };
    }, [trajectoryId, enabled, runFetch, setTrajectory, setError, setLoading, resetAnalyses]);

    useEffect(() => {
        return () => {
            activeRequestIdRef.current += 1;
            resetAnalyses();
        };
    }, [resetAnalyses]);

    return {
        trajectory,
        isLoading,
        error,
        isReady: !!trajectory && trajectory._id === trajectoryId && !isLoading,
        accessDenied,
        accessDeniedMessage,
        refetch: fetchTrajectory
    };
};

export default useGetTrajectoryById;
