import Job from '@modules/jobs/domain/entities/Job';

export interface IAnalysisQueue {
    addJobs(jobs: Job[]): Promise<void>;
};
