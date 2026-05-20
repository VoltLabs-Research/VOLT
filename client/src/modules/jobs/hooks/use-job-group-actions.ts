import { useRemoveRunningJobsMutation, useRetryFailedJobsMutation } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';

const useJobGroupActions = (trajectoryId: string) => {
    const removeRunningJobsMutation = useRemoveRunningJobsMutation();
    const retryFailedJobsMutation = useRetryFailedJobsMutation();

    let loadingAction: 'remove' | 'retry' | null = null;
    if (removeRunningJobsMutation.isPending) {
        loadingAction = 'remove';
    } else if (retryFailedJobsMutation.isPending) {
        loadingAction = 'retry';
    }

    const handleRemoveRunningJobs = useCallback(async () => {
        await showPromise(
            removeRunningJobsMutation.mutateAsync({ trajectoryId }),
            {
                loading: { title: 'Removing queued and running jobs...' },
                success: (data) => {
                    if (data.clusterFailures.length > 0) {
                        if (data.deletedJobs === 0) {
                            return { title: 'No jobs removed; some clusters did not confirm the request' };
                        }

                        return { title: `Removed ${data.deletedJobs} job(s); some clusters did not fully confirm` };
                    }

                    if (data.deletedJobs === 0) {
                        return { title: 'No queued or running jobs found' };
                    }

                    return { title: `Removed ${data.deletedJobs} job(s)` };
                },
                error: { title: 'Failed to remove jobs' }
            }
        );
    }, [removeRunningJobsMutation, trajectoryId]);

    const handleRetryFailedJobs = useCallback(async () => {
        await showPromise(
            retryFailedJobsMutation.mutateAsync({ trajectoryId }),
            {
                loading: { title: 'Retrying failed jobs...' },
                success: (data) => {
                    if (data.retriedFrames === 0) {
                        return { title: 'No failed jobs found to retry' };
                    }

                    return { title: `Queued ${data.retriedFrames} failed job(s) for retry` };
                },
                error: { title: 'Failed to retry failed jobs' }
            }
        );
    }, [retryFailedJobsMutation, trajectoryId]);

    return {
        loadingAction,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    };
};

export default useJobGroupActions;
