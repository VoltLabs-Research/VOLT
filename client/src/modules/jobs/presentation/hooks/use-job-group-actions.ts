import { useCallback, useState } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';
import useJobsUseCases from '@/modules/jobs/presentation/hooks/use-jobs-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';

interface UseJobGroupActionsArgs {
    group: TrajectoryJobGroup;
    onRemoveTrajectoryGroup: (trajectoryId: string) => void;
}

const useJobGroupActions = ({ group, onRemoveTrajectoryGroup }: UseJobGroupActionsArgs) => {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const { jobsRepository } = useJobsUseCases();
    const clearHistoryAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to clear history', error);
        },
        onFinally: () => setLoadingAction(null)
    });

    const removeRunningJobsAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to remove running jobs', error);
        },
        onFinally: () => setLoadingAction(null)
    });

    const retryFailedJobsAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to retry failed jobs', error);
        },
        onFinally: () => setLoadingAction(null)
    });

    const handleClearHistory = useCallback(async () => {
        setLoadingAction('clear');
        onRemoveTrajectoryGroup(group.trajectoryId);
        await clearHistoryAction.execute(async () => {
            const response = await showPromise(
                jobsRepository.clearHistory(group.trajectoryId),
                {
                    loading: { title: 'Clearing history...' },
                    success: (data) => ({
                        title: `History cleared: ${data.deletedJobs} jobs and ${data.deletedAnalyses} analyses removed`
                    }),
                    error: { title: 'Failed to clear history' }
                }
            );
            return response;
        });
    }, [group.trajectoryId, jobsRepository, onRemoveTrajectoryGroup, clearHistoryAction]);

    const handleRemoveRunningJobs = useCallback(async () => {
        setLoadingAction('remove');
        await removeRunningJobsAction.execute(async () => {
            const response = await showPromise(
                jobsRepository.removeRunningJobs(group.trajectoryId),
                {
                    loading: { title: 'Removing running jobs...' },
                    success: (data) => ({
                        title: data.deletedJobs === 0
                            ? 'No running jobs found'
                            : `Removed ${data.deletedJobs} running jobs and ${data.deletedAnalyses} analyses`
                    }),
                    error: { title: 'Failed to remove running jobs' }
                }
            );
            return response;
        });
    }, [group.trajectoryId, jobsRepository, removeRunningJobsAction]);

    const handleRetryFailedJobs = useCallback(async () => {
        setLoadingAction('retry');
        await retryFailedJobsAction.execute(async () => {
            const response = await showPromise(
                jobsRepository.retryFailedJobs(group.trajectoryId),
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
            return response;
        });
    }, [group.trajectoryId, jobsRepository, retryFailedJobsAction]);

    return {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    };
};

export default useJobGroupActions;
