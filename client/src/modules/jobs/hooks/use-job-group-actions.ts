import { useCallback } from 'react';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useClearJobHistoryMutation, useRemoveRunningJobsMutation, useRetryFailedJobsMutation } from './queries';

const useJobGroupActions = () => {
    const clearHistoryMutation = useClearJobHistoryMutation();
    const removeRunningJobsMutation = useRemoveRunningJobsMutation();
    const retryFailedJobsMutation = useRetryFailedJobsMutation();

    const loadingAction = clearHistoryMutation.isPending ? 'clear'
        : removeRunningJobsMutation.isPending ? 'remove'
        : retryFailedJobsMutation.isPending ? 'retry'
        : null;

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
                success: (data) => ({
                    title: data.deletedJobs === 0
                        ? 'No running jobs found'
                        : `Removed ${data.deletedJobs} running jobs`
                }),
                error: { title: 'Failed to remove running jobs' }
            }
        );
    }, [removeRunningJobsMutation]);

    const handleRetryFailedJobs = useCallback(async () => {
        await showPromise(
            retryFailedJobsMutation.mutateAsync(),
            {
                loading: { title: 'Retrying failed jobs...' },
                success: (data) => ({
                    title: data.retriedFrames === 0
                        ? 'No failed frames found to retry'
                        : `Queued ${data.retriedFrames} failed frames for retry`
                }),
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
