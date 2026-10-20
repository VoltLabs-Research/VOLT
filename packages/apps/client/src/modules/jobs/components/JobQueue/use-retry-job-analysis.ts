import { useCallback } from 'react';
import { useRetryFailedFramesMutation } from '@/modules/analysis/hooks/queries';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { RetryFailedFramesResponse } from '@volt/contracts/modules/analysis/domain';

const useRetryJobAnalysis = () => {
    const mutation = useRetryFailedFramesMutation();

    return useCallback(async (analysisId: string): Promise<RetryFailedFramesResponse | null> => {
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
        } catch {
            return null;
        }
    }, [mutation]);
};

export default useRetryJobAnalysis;
