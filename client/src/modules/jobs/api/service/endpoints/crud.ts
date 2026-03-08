import { post, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { ClearHistoryOutputDTO } from '../../dtos/clear-history';
import type { RemoveRunningJobsOutputDTO } from '../../dtos/remove-running-jobs';
import type { RetryFailedJobsOutputDTO } from '../../dtos/retry-failed-jobs';

const endpoints = {
    clearHistory: post<EmptyParams, ClearHistoryOutputDTO>('/clear-history'),
    removeRunningJobs: post<EmptyParams, RemoveRunningJobsOutputDTO>('/remove-running'),
    retryFailedJobs: post<EmptyParams, RetryFailedJobsOutputDTO>('/retry-failed')
};

export default endpoints;
