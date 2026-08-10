import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { computeGroupStatus } from '@/modules/jobs/utils/job-status-semantics';
import type { Job, TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

/*
 * Re-exported so existing importers keep their path. The definition lives in
 * `job-status-semantics`, next to the predicates it is built from.
 */
export { computeGroupStatus };

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

const parseTimestamp = (timestamp: string): number => {
    const parsedTimestamp = Date.parse(timestamp);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
};

const UNGROUPED_TIMESTEP = -1;

const buildTrajectoryGroup = (updatedJob: Job): TrajectoryJobGroup => {
    const timestep = resolveJobTimestep(updatedJob) ?? UNGROUPED_TIMESTEP;
    const normalizedJob: Job = {
        ...updatedJob,
        timestep
    };

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

    const normalizedJob: Job = {
        ...updatedJob,
        timestep
    };
    const trajIndex = groups.findIndex((group) => group.trajectoryId === updatedJob.trajectoryId);
    if (trajIndex === -1) {
        const trajectoryGroup = buildTrajectoryGroup(normalizedJob);

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
            && existingJob.revision !== undefined
            && normalizedJob.revision !== undefined
            && normalizedJob.revision < existingJob.revision
            ? existingJob
            : existingJob
                ? {
                    ...existingJob,
                    ...normalizedJob
                }
                : normalizedJob;
        const nextJob: Job = {
            ...nextJobSource,
            timestep: resolveJobTimestep(nextJobSource) ?? timestep
        };
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
