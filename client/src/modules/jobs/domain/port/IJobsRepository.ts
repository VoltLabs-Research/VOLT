import type {
    ClearHistoryOutputDTO,
    RemoveRunningJobsOutputDTO,
    RetryFailedJobsOutputDTO
} from '../../application/dtos';

export default interface IJobsRepository {
    clearHistory(trajectoryId: string): Promise<ClearHistoryOutputDTO>;
    removeRunningJobs(trajectoryId: string): Promise<RemoveRunningJobsOutputDTO>;
    retryFailedJobs(trajectoryId: string): Promise<RetryFailedJobsOutputDTO>;
};
