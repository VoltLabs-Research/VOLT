import { useRetryFailedFramesMutation } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

const getRetryFailedFramesSuccessTitle = (retriedFrames: number): string => {
    if (retriedFrames === 0) {
        return 'No failed frames found to retry';
    }

    let frameLabel = 'failed frame';
    if (retriedFrames > 1) {
        frameLabel = 'failed frames';
    }

    return `Queued ${retriedFrames} ${frameLabel} for retry`;
};

const useRetryFailedFrames = () => {
    const mutation = useRetryFailedFramesMutation();

    const retryFailedFrames = useCallback(async (analysisId: string) => {
        try {
            return await showPromise(
                mutation.mutateAsync({ analysisId }),
                {
                    loading: { title: 'Retrying failed frames...' },
                    success: (result) => ({ title: getRetryFailedFramesSuccessTitle(result.retriedFrames) }),
                    error: { title: 'Failed to retry frames' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
            throw error;
        }
    }, [mutation]);

    return retryFailedFrames;
};

export default useRetryFailedFrames;
