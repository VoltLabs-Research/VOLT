import { useCallback } from 'react';
import { useRetryFailedFramesMutation } from '@/modules/analysis/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

const useRetryJobAnalysis = () => {
    const mutation = useRetryFailedFramesMutation();

    return useCallback(async (analysisId: string) => {
        try {
            return await showPromise(
                mutation.mutateAsync({ analysisId }),
                {
                    loading: { title: 'Retrying failed frames...' },
                    success: (result) => {
                        let title = 'No failed frames found to retry';

                        if (result && result.retriedFrames !== 0) {
                            const suffix = result.retriedFrames > 1 ? 's' : '';
                            title = `Queued ${result.retriedFrames} failed frame${suffix} for retry`;
                        }

                        return { title };
                    },
                    error: { title: 'Failed to retry frames' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) {
                return;
            }

            throw error;
        }
    }, [mutation]);
};

export default useRetryJobAnalysis;
