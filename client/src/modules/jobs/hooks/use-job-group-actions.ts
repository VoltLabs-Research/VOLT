import { useClearJobHistoryMutation, useRemoveRunningJobsMutation, useRetryFailedJobsMutation } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';

const useJobGroupActions = () => {
    const clearHistoryMutation = useClearJobHistoryMutation();
    const removeRunningJobsMutation = useRemoveRunningJobsMutation();
    const retryFailedJobsMutation = useRetryFailedJobsMutation();

    let loadingAction: 'clear' | 'remove' | 'retry' | null = null;
    if (clearHistoryMutation.isPending) {
        loadingAction = 'clear';
    } else if (removeRunningJobsMutation.isPending) {
        loadingAction = 'remove';
    } else if (retryFailedJobsMutation.isPending) {
        loadingAction = 'retry';
    }

    const handleClearHistory = useCallback(async () => {
        await showPromise(
            clearHistoryMutation.mutateAsync(),
            {
                loading: { title: 'Clearing history...' },
                success: (data) => ({
                    title: `History cleared: ${data.deletedJobs + data.deletedAnalyses} records removed`
                }),
                error: { title: 'Failed to clear history' }
            }
        );
    }, [clearHistoryMutation]);

    const handleRemoveRunningJobs = useCallback(async () => {
        await showPromise(
            removeRunningJobsMutation.mutateAsync(),
            {
                loading: { title: 'Removing running jobs...' },
                success: (data) => {
                    let title = `Removed ${data.deletedJobs} running jobs`;
                    if (data.deletedJobs === 0) {
                        title = 'No running jobs found';
                    }

                    return { title };
                },
                error: { title: 'Failed to remove running jobs' }
            }
        );
    }, [removeRunningJobsMutation]);

    const handleRetryFailedJobs = useCallback(async () => {
        await showPromise(
            retryFailedJobsMutation.mutateAsync(),
            {
                loading: { title: 'Retrying failed jobs...' },
                success: (data) => {
                    let title = `Queued ${data.retriedFrames} failed frames for retry`;
                    if (data.retriedFrames === 0) {
                        title = 'No failed frames found to retry';
                    }

                    return { title };
                },
                error: { title: 'Failed to retry failed jobs' }
            }
        );
    }, [retryFailedJobsMutation]);

    return {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    };
};

export default useJobGroupActions;
