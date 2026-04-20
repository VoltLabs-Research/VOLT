import { post, del } from '@/app/core/http/utilities/create-service';
import type { RemoveRunningJobsOutputDTO, RemoveRunningJobsParams } from '../../dtos/remove-running-jobs';
import type { RetryFailedJobsOutputDTO, RetryFailedJobsParams } from '../../dtos/retry-failed-jobs';

const endpoints = {
    removeRunningJobs: del<RemoveRunningJobsParams, RemoveRunningJobsOutputDTO>('/:trajectoryId/running', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<RetryFailedJobsParams, RetryFailedJobsOutputDTO>('/:trajectoryId/failed/retries')
};

export default endpoints;
