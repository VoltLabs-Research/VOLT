import type { TrajectoryJobGroup, Job } from '../entities/Job';

export class JobGroupService {
    flattenGroups(groups: TrajectoryJobGroup[]): Job[] {
        return groups.flatMap((group) => group.frameGroups.flatMap((frame) => frame.jobs));
    }

    filterJobs(
        groups: TrajectoryJobGroup[],
        trajectoryId?: string,
        queueFilter?: string
    ): Job[] {
        let jobs = this.flattenGroups(groups);
        if (trajectoryId) {
            jobs = jobs.filter((job) => job.trajectoryId === trajectoryId);
        }
        if (queueFilter) {
            jobs = jobs.filter((job) => job.queueType?.includes(queueFilter));
        }
        return jobs;
    }
}
