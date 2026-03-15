import { post, del } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { ClearHistoryOutputDTO } from '../../dtos/clear-history';
import type { RemoveRunningJobsOutputDTO } from '../../dtos/remove-running-jobs';
import type { RetryFailedJobsOutputDTO } from '../../dtos/retry-failed-jobs';

const endpoints = {
    clearHistory: del<EmptyParams, ClearHistoryOutputDTO>('/history', {
        unwrap: 'data'
    }),
    removeRunningJobs: del<EmptyParams, RemoveRunningJobsOutputDTO>('/running', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<EmptyParams, RetryFailedJobsOutputDTO>('/failed/retries')
};

export default endpoints;
