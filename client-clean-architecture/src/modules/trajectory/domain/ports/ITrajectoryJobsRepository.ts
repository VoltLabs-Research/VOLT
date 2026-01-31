import type {
    ClearHistoryOutputDTO,
    RemoveRunningJobsOutputDTO,
    RetryFailedJobsOutputDTO
} from '../../application/dtos/jobs';

export default interface ITrajectoryJobsRepository{
    clearHistory(trajectoryId: string): Promise<ClearHistoryOutputDTO>;
    removeRunningJobs(trajectoryId: string): Promise<RemoveRunningJobsOutputDTO>;
    retryFailedJobs(trajectoryId: string): Promise<RetryFailedJobsOutputDTO>;
};
