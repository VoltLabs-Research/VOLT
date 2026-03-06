import Job from '@modules/jobs/domain/entities/Job';

export interface ISSHImportQueue {
    addJobs(jobs: Job[]): Promise<void>;
}
