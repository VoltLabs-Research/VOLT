import type { FrameJobGroupStatus, Job, TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';

export const computeGroupStatus = (jobs: Job[]): FrameJobGroupStatus => {
    const hasRunning = jobs.some((job) => job.status === 'running');
    const hasQueued = jobs.some((job) => job.status === 'queued' || job.status === 'retrying');
    const hasFailed = jobs.some((job) => job.status === 'failed');
    const allCompleted = jobs.every((job) => job.status === 'completed');

    if (hasRunning) return 'running';
    if (hasQueued) return 'queued';
    if (allCompleted) return 'completed';
    if (hasFailed && jobs.filter((job) => job.status === 'completed').length === 0) return 'failed';
    return 'partial';
};

const buildTrajectoryGroup = (updatedJob: Job): TrajectoryJobGroup => {
    const trajectoryName = updatedJob.message || `Trajectory ${updatedJob.trajectoryId.slice(-6)}`;

    return {
        trajectoryId: updatedJob.trajectoryId,
        trajectoryName,
        frameGroups: [{
            timestep: updatedJob.timestep,
            jobs: [updatedJob],
            overallStatus: 'running'
        }],
        latestTimestamp: updatedJob.timestamp || new Date().toISOString(),
        overallStatus: 'running',
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
        const newFrameGroups = frameIndex === -1
            ? [{
                timestep: updatedJob.timestep,
                jobs: [updatedJob],
                overallStatus: 'running'
            }, ...group.frameGroups]
            : group.frameGroups.map((frame, framePosition) => {
                if (framePosition !== frameIndex) return frame;

                const jobIndex = frame.jobs.findIndex((job) => job.jobId === updatedJob.jobId);
                const newJobs = jobIndex >= 0
                    ? frame.jobs.map((job, jobPosition) => (jobPosition === jobIndex ? { ...job, ...updatedJob } : job))
                    : [updatedJob, ...frame.jobs];

                return {
                    ...frame,
                    jobs: newJobs,
                    overallStatus: computeGroupStatus(newJobs)
                };
            });

        const allJobs = newFrameGroups.flatMap((frame) => frame.jobs);
        const overallStatus = computeGroupStatus(allJobs);

        return {
            ...group,
            frameGroups: newFrameGroups,
            overallStatus,
            completedCount: allJobs.filter((job) => job.status === 'completed').length,
            totalCount: allJobs.length,
            latestTimestamp: updatedJob.timestamp || group.latestTimestamp
        };
    });
};
