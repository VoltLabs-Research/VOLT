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

const isUngroupedTimestep = (timestep: number): boolean => timestep === UNGROUPED_TIMESTEP;

const compareFrameTimesteps = (left: number, right: number): number => {
    if (isUngroupedTimestep(left) && isUngroupedTimestep(right)) {
        return 0;
    }

    if (isUngroupedTimestep(left)) {
        return -1;
    }

    if (isUngroupedTimestep(right)) {
        return 1;
    }

    return right - left;
};

const resolveJobTimestep = (job: Job): number | undefined => {
    return job.timestep ?? job.metadata?.timestep;
};

const normalizeJobTimestep = (job: Job, timestep: number): Job => {
    return {
        ...job,
        timestep
    };
};

const parseTimestamp = (timestamp?: string): number => {
    if (typeof timestamp !== 'string' || timestamp.trim().length === 0) {
        return 0;
    }

    const parsedTimestamp = Date.parse(timestamp);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
};

const UNGROUPED_TIMESTEP = -1;

const buildTrajectoryGroup = (updatedJob: Job): TrajectoryJobGroup | null => {
    const timestep = resolveJobTimestep(updatedJob) ?? UNGROUPED_TIMESTEP;
    const normalizedJob = normalizeJobTimestep(updatedJob, timestep);

    return {
        trajectoryId: updatedJob.trajectoryId,
        trajectoryName: updatedJob.trajectoryName as string,
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
    const timestep = resolveJobTimestep(updatedJob) ?? UNGROUPED_TIMESTEP;

    const normalizedJob = normalizeJobTimestep(updatedJob, timestep);
    const trajIndex = groups.findIndex((group) => group.trajectoryId === updatedJob.trajectoryId);
    if (trajIndex === -1) {
        const trajectoryGroup = buildTrajectoryGroup(normalizedJob);

        if (!trajectoryGroup) {
            return groups;
        }

        return [trajectoryGroup, ...groups];
    }

    const updatedGroups = groups.map((group, index) => {
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
        const nextJobSource = existingJob
            && typeof existingJob.revision === 'number'
            && typeof normalizedJob.revision === 'number'
            && normalizedJob.revision < existingJob.revision
            ? existingJob
            : existingJob
                ? {
                    ...existingJob,
                    ...normalizedJob
                }
                : normalizedJob;
        const nextJob = normalizeJobTimestep(
            nextJobSource,
            resolveJobTimestep(nextJobSource) ?? timestep
        );
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

        newFrameGroups.sort((left, right) => compareFrameTimesteps(left.timestep, right.timestep));

        const allJobs = newFrameGroups.flatMap((frame) => frame.jobs);
        const overallStatus = computeGroupStatus(allJobs);

        return {
            ...group,
            trajectoryName: nextJob.trajectoryName as string,
            frameGroups: newFrameGroups,
            overallStatus,
            completedCount: allJobs.filter((job) => job.status === JobStatus.Completed).length,
            totalCount: allJobs.length,
            latestTimestamp: nextJob.timestamp || group.latestTimestamp
        };
    });

    return updatedGroups.sort((left, right) => {
        const timestampDifference = parseTimestamp(right.latestTimestamp) - parseTimestamp(left.latestTimestamp);
        if (timestampDifference !== 0) {
            return timestampDifference;
        }

        return left.trajectoryId.localeCompare(right.trajectoryId);
    });
};
