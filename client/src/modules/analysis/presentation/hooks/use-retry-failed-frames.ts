import { useCallback } from 'react';
import useAnalysisUseCases from './use-analysis-services';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';

const useRetryFailedFrames = () => {
    const { retryFailedFramesUseCase } = useAnalysisUseCases();
    const retryFailedFrames = useCallback(async (id: string) => {
        try{
            return await showPromise(
                retryFailedFramesUseCase.execute({ id }),
                {
                    loading: { title: 'Retrying failed frames...' },
                    success: (result) => ({
                        title: result.retriedFrames === 0
                            ? 'No failed frames found to retry'
                            : `Queued ${result.retriedFrames} failed frame${result.retriedFrames > 1 ? 's' : ''} for retry`
                    }),
                    error: { title: 'Failed to retry frames' }
                }
            );
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [retryFailedFramesUseCase]);

    return retryFailedFrames;
};

export default useRetryFailedFrames;
