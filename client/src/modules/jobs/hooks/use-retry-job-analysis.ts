import { useCallback } from 'react';
import { useRetryFailedFramesMutation } from '@/modules/analysis/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';

const useRetryJobAnalysis = () => {
    const mutation = useRetryFailedFramesMutation();

    return useCallback(async (analysisId: string) => {
        try {
            return await showPromise(
                mutation.mutateAsync({ analysisId }),
                {
                    loading: { title: 'Retrying failed frames...' },
                    success: (result) => ({
                        title: !result || result.retriedFrames === 0
                            ? 'No failed frames found to retry'
                            : `Queued ${result.retriedFrames} failed frame${result.retriedFrames > 1 ? 's' : ''} for retry`
                    }),
                    error: { title: 'Failed to retry frames' }
                }
            );
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) {
                return;
            }

            throw error;
        }
    }, [mutation]);
};

export default useRetryJobAnalysis;
