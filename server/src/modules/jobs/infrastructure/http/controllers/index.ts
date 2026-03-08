import ClearTeamJobsHistoryController from './ClearTeamJobsHistoryController';
import RemoveTeamRunningJobsController from './RemoveTeamRunningJobsController';
import RetryTeamFailedJobsController from './RetryTeamFailedJobsController';
import { container } from 'tsyringe';

export default {
    clearHistory: container.resolve(ClearTeamJobsHistoryController),
    removeRunningJobs: container.resolve(RemoveTeamRunningJobsController),
    retryFailedJobs: container.resolve(RetryTeamFailedJobsController)
};
