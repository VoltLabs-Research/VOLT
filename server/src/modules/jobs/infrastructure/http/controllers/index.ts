import ClearTeamJobsHistoryController from './ClearTeamJobsHistoryController';
import RemoveTeamRunningJobsController from './RemoveTeamRunningJobsController';
import RetryTeamFailedJobsController from './RetryTeamFailedJobsController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    clearHistory: ClearTeamJobsHistoryController,
    removeRunningJobs: RemoveTeamRunningJobsController,
    retryFailedJobs: RetryTeamFailedJobsController
});