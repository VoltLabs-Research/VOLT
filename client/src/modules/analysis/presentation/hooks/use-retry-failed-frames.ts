import { useCallback } from 'react';
import useAnalysisUseCases from './use-analysis-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';

const useRetryFailedFrames = () => {
    const { retryFailedFramesUseCase } = useAnalysisUseCases();
    const retryFailedFrames = useCallback(async (id: string) => {
        return showPromise(
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
    }, [retryFailedFramesUseCase]);

    return retryFailedFrames;
};

export default useRetryFailedFrames;
