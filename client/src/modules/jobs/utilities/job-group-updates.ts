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

const resolveJobTimestep = (job: Job): number | undefined => {
    if (typeof job.timestep === 'number') {
        return job.timestep;
    }

    if (typeof job.metadata?.timestep === 'number') {
        return job.metadata.timestep;
    }

    if (typeof job.metadata?.timestep === 'string' && job.metadata.timestep.trim().length > 0) {
        const parsedTimestep = Number(job.metadata.timestep);
        if (Number.isFinite(parsedTimestep)) {
            return parsedTimestep;
        }
    }

    return undefined;
};

const normalizeJobTimestep = (job: Job, timestep: number): Job => {
    return {
        ...job,
        timestep
    };
};

const buildTrajectoryGroup = (updatedJob: Job): TrajectoryJobGroup | null => {
    if (!updatedJob.trajectoryName) {
        return null;
    }

    const timestep = resolveJobTimestep(updatedJob);
    if (typeof timestep === 'undefined') {
        return null;
    }

    const normalizedJob = normalizeJobTimestep(updatedJob, timestep);

    return {
        trajectoryId: updatedJob.trajectoryId,
        trajectoryName: updatedJob.trajectoryName,
        frameGroups: [{
            timestep,
            jobs: [normalizedJob],
            overallStatus: computeGroupStatus([normalizedJob])
        }],
        latestTimestamp: updatedJob.timestamp || new Date().toISOString(),
        overallStatus: computeGroupStatus([normalizedJob]),
        completedCount: normalizedJob.status === JobStatus.Completed ? 1 : 0,
        totalCount: 1
    };
};

export const applyJobUpdate = (
    groups: TrajectoryJobGroup[],
    updatedJob: Job
): TrajectoryJobGroup[] => {
    const timestep = resolveJobTimestep(updatedJob);
    if (typeof timestep === 'undefined') {
        return groups;
    }

    const normalizedJob = normalizeJobTimestep(updatedJob, timestep);
    const trajIndex = groups.findIndex((group) => group.trajectoryId === updatedJob.trajectoryId);
    if (trajIndex === -1) {
        const trajectoryGroup = buildTrajectoryGroup(normalizedJob);

        if (!trajectoryGroup) {
            return groups;
        }

        return [trajectoryGroup, ...groups];
    }

    return groups.map((group, index) => {
        if (index !== trajIndex) return group;

        let existingJob: Job | undefined;
        const frameGroupsWithoutExistingJob = group.frameGroups
            .map((frame) => {
                const matchedJob = frame.jobs.find((job) => job.jobId === normalizedJob.jobId);
                if (matchedJob) {
                    existingJob = matchedJob;
                }

                return {
                    ...frame,
                    jobs: frame.jobs.filter((job) => job.jobId !== normalizedJob.jobId)
                };
            })
            .filter((frame) => frame.jobs.length > 0);
        const nextJob = existingJob
            ? normalizeJobTimestep({
                ...existingJob,
                ...normalizedJob
            }, timestep)
            : normalizedJob;
        const frameIndex = frameGroupsWithoutExistingJob.findIndex((frame) => frame.timestep === timestep);
        let newFrameGroups = frameGroupsWithoutExistingJob;

        if (frameIndex === -1) {
            newFrameGroups = [{
                timestep,
                jobs: [nextJob],
                overallStatus: computeGroupStatus([nextJob])
            }, ...frameGroupsWithoutExistingJob];
        } else {
            newFrameGroups = frameGroupsWithoutExistingJob.map((frame, framePosition) => {
                if (framePosition !== frameIndex) return frame;

                const newJobs = [nextJob, ...frame.jobs];

                return {
                    ...frame,
                    jobs: newJobs,
                    overallStatus: computeGroupStatus(newJobs)
                };
            });
        }

        newFrameGroups.sort((left, right) => right.timestep - left.timestep);

        const allJobs = newFrameGroups.flatMap((frame) => frame.jobs);
        const overallStatus = computeGroupStatus(allJobs);

        return {
            ...group,
            trajectoryName: updatedJob.trajectoryName || group.trajectoryName,
            frameGroups: newFrameGroups,
            overallStatus,
            completedCount: allJobs.filter((job) => job.status === JobStatus.Completed).length,
            totalCount: allJobs.length,
            latestTimestamp: updatedJob.timestamp || group.latestTimestamp
        };
    });
};
