import { defineServiceModule } from '@/shared/api/service-module';
import { del, post } from '@/app/core/http/utilities/create-service';
import type { RemoveRunningJobsOutputDTO, RemoveRunningJobsParams } from './dtos/remove-running-jobs';
import type { RetryFailedJobsOutputDTO, RetryFailedJobsParams } from './dtos/retry-failed-jobs';

const endpoints = {
    removeRunningJobs: del<RemoveRunningJobsParams, RemoveRunningJobsOutputDTO>('/:trajectoryId/running', {
        unwrap: 'data'
    }),
    retryFailedJobs: post<RetryFailedJobsParams, RetryFailedJobsOutputDTO>('/:trajectoryId/failed/retries')
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/jobs',
            useRBAC: true
        }
    },
    endpoints
});
