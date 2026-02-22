import { container } from 'tsyringe';
import ClearTeamJobsHistoryController from '@modules/jobs/infrastructure/http/controllers/ClearTeamJobsHistoryController';
import RemoveTeamRunningJobsController from '@modules/jobs/infrastructure/http/controllers/RemoveTeamRunningJobsController';
import RetryTeamFailedJobsController from '@modules/jobs/infrastructure/http/controllers/RetryTeamFailedJobsController';

export default {
    clearHistory: container.resolve(ClearTeamJobsHistoryController),
    removeRunningJobs: container.resolve(RemoveTeamRunningJobsController),
    retryFailedJobs: container.resolve(RetryTeamFailedJobsController)
};
