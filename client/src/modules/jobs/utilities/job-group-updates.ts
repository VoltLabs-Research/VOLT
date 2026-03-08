import { FrameJobGroupStatus, JobStatus } from '../api/entities/job';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';

export const computeGroupStatus = (jobs: Job[]): FrameJobGroupStatus => {
    const hasRunning = jobs.some((job) => job.status === JobStatus.Running);
    const hasQueued = jobs.some((job) => job.status === JobStatus.Queued || job.status === JobStatus.Retrying || job.status === JobStatus.QueuedAfterFailure);
    const hasFailed = jobs.some((job) => job.status === JobStatus.Failed);
    const allCompleted = jobs.every((job) => job.status === JobStatus.Completed);

    if (hasRunning) return FrameJobGroupStatus.Running;
    if (hasQueued) return FrameJobGroupStatus.Queued;
    if (allCompleted) return FrameJobGroupStatus.Completed;
    if (hasFailed && jobs.filter((job) => job.status === JobStatus.Completed).length === 0) return FrameJobGroupStatus.Failed;
    return FrameJobGroupStatus.Partial;
};

const buildTrajectoryGroup = (updatedJob: Job): TrajectoryJobGroup => {
    const trajectoryName = updatedJob.message || `Trajectory ${updatedJob.trajectoryId.slice(-6)}`;

    return {
        trajectoryId: updatedJob.trajectoryId,
        trajectoryName,
        frameGroups: [{
            timestep: updatedJob.timestep,
            jobs: [updatedJob],
            overallStatus: computeGroupStatus([updatedJob])
        }],
        latestTimestamp: updatedJob.timestamp || new Date().toISOString(),
        overallStatus: FrameJobGroupStatus.Running,
        completedCount: 0,
        totalCount: 1
    };
};

export const applyJobUpdate = (
    groups: TrajectoryJobGroup[],
    updatedJob: Job
): TrajectoryJobGroup[] => {
    const trajIndex = groups.findIndex((group) => group.trajectoryId === updatedJob.trajectoryId);
    if (trajIndex === -1) {
        return [buildTrajectoryGroup(updatedJob), ...groups];
    }

    return groups.map((group, index) => {
        if (index !== trajIndex) return group;

        const frameIndex = group.frameGroups.findIndex((frame) => frame.timestep === updatedJob.timestep);
        let newFrameGroups = group.frameGroups;

        if (frameIndex === -1) {
            newFrameGroups = [{
                timestep: updatedJob.timestep,
                jobs: [updatedJob],
                overallStatus: computeGroupStatus([updatedJob])
            }, ...group.frameGroups];
        } else {
            newFrameGroups = group.frameGroups.map((frame, framePosition) => {
                if (framePosition !== frameIndex) return frame;

                const jobIndex = frame.jobs.findIndex((job) => job.jobId === updatedJob.jobId);
                let newJobs = [updatedJob, ...frame.jobs];

                if (jobIndex >= 0) {
                    newJobs = frame.jobs.map((job, jobPosition) => {
                        if (jobPosition === jobIndex) {
                            return {
                                ...job,
                                ...updatedJob
                            };
                        }

                        return job;
                    });
                }

                return {
                    ...frame,
                    jobs: newJobs,
                    overallStatus: computeGroupStatus(newJobs)
                };
            });
        }

        const allJobs = newFrameGroups.flatMap((frame) => frame.jobs);
        const overallStatus = computeGroupStatus(allJobs);

        return {
            ...group,
            frameGroups: newFrameGroups,
            overallStatus,
            completedCount: allJobs.filter((job) => job.status === JobStatus.Completed).length,
            totalCount: allJobs.length,
            latestTimestamp: updatedJob.timestamp || group.latestTimestamp
        };
    });
};
