import { useCallback } from 'react';
import { toast } from 'sonner';
import useAnalysisUseCases from './use-analysis-use-cases';

const useRetryFailedFrames = () => {
    const { retryFailedFramesUseCase } = useAnalysisUseCases();

    const retryFailedFrames = useCallback(async (id: string) => {
        try {
            const result = await retryFailedFramesUseCase.execute({ id });

            if(result.retriedFrames === 0) {
                toast.info('No failed frames found to retry');
            } else {
                const plural = result.retriedFrames > 1 ? 's' : '';
                toast.success(`Queued ${result.retriedFrames} failed frame${plural} for retry`);
            }

            return result;
        } catch(error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to retry frames';
            toast.error(message);
            throw error;
        }
    }, [retryFailedFramesUseCase]);

    return retryFailedFrames;
};

export default useRetryFailedFrames;
