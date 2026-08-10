import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import { JobStatus } from '@shared/contracts/types/JobStatus';
import {
    JOB_STATUS_KEY_PREFIX,
    projectedTeamJobsKey,
    projectedTeamJobsRevisionKey
} from '@modules/jobs/services/JobRuntimeKeys';
import type { TeamJobSnapshot, TeamJobStatus } from '@shared/contracts/types/TeamJobSnapshot';
import logger from '@shared/infrastructure/logger';

const SAFE_FALLBACK_GROUP_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const UNGROUPED_TIMESTEP = -1;
const MAX_INITIAL_SNAPSHOT_ATTEMPTS = 5;

const parseTimestamp = (timestamp?: string): number | undefined => {
    if (!timestamp || timestamp.trim().length === 0) {
        return undefined;
    }

    const parsedTimestamp = Date.parse(timestamp);

    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined;
};

const compareFrameTimesteps = (left: number, right: number): number => {
    if (left === UNGROUPED_TIMESTEP && right === UNGROUPED_TIMESTEP) {
        return 0;
    }

    if (left === UNGROUPED_TIMESTEP) {
        return -1;
    }

    if (right === UNGROUPED_TIMESTEP) {
        return 1;
    }

    return right - left;
};

export type TeamJobSummary = TeamJobSnapshot;

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: string;
    completedCount: number;
    totalCount: number;
};

interface FrameJobGroup {
    timestep: number;
    jobs: TeamJobSummary[];
    overallStatus: string;
};

export interface TeamJobsInitialPayload {
    revision: number;
    groups: TrajectoryJobGroup[];
};

export default class TeamJobsService {
    private async getTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
        return this.groupJobsByTrajectory(await this.getFlatTeamJobs(teamId));
    }

    async getInitialTeamJobs(teamId: string): Promise<TeamJobsInitialPayload> {
        for (let attempt = 0; attempt < MAX_INITIAL_SNAPSHOT_ATTEMPTS; attempt += 1) {
            const revisionBefore = await this.getProjectedTeamJobsRevision(teamId);
            const groupedJobs = await this.getTeamJobs(teamId);
            const revisionAfter = await this.getProjectedTeamJobsRevision(teamId);

            if (revisionBefore === revisionAfter) {
                return {
                    revision: revisionAfter,
                    groups: groupedJobs
                };
            }
        }

        return {
            revision: await this.getProjectedTeamJobsRevision(teamId),
            groups: await this.getTeamJobs(teamId)
        };
    }

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        return (await this.getProjectedTeamJobs(teamId)).sort((left, right) => this.compareJobsForDisplay(left, right));
    }

    private async getProjectedTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const store = getKeyValueStore();
        const jobIds = await store.setMembers(projectedTeamJobsKey(teamId));
        if (jobIds.length === 0) {
            return [];
        }

        const records = await store.getMany(jobIds.map((jobId) => `${JOB_STATUS_KEY_PREFIX}${jobId}`));
        const jobs: TeamJobSummary[] = [];
        const staleJobIds: string[] = [];

        for (const [index, record] of records.entries()) {
            if (!record) {
                if (jobIds[index]) {
                    staleJobIds.push(jobIds[index]);
                }
                continue;
            }

            jobs.push({
                ...(JSON.parse(record) as TeamJobSummary),
                source: 'projected'
            });
        }

        if (staleJobIds.length > 0) {
            /* Pruning is opportunistic: the caller's jobs are already assembled, so a
               failed cleanup costs a repeated miss rather than a wrong answer. */
            store.setRemove(projectedTeamJobsKey(teamId), staleJobIds).catch(() => {
                logger.warn(`Failed to prune stale projected team jobs staleJobCount=${staleJobIds.length} teamId=${teamId}`);
            });
        }

        return jobs;
    }

    private groupJobsByTrajectory(jobs: TeamJobSummary[]): TrajectoryJobGroup[] {
        const trajectoryMap = new Map<string, TeamJobSummary[]>();

        for (const job of jobs) {
            const trajectoryId = job.trajectoryId;

            if (!trajectoryId) {
                continue;
            }

            const trajectoryJobs = trajectoryMap.get(trajectoryId);
            if (trajectoryJobs) {
                trajectoryJobs.push(job);
                continue;
            }
            trajectoryMap.set(trajectoryId, [job]);
        }

        const groups: TrajectoryJobGroup[] = [];

        for (const [trajectoryId, trajectoryJobs] of trajectoryMap.entries()) {
            const frameMap = new Map<number, TeamJobSummary[]>();

            for (const job of trajectoryJobs) {
                const timestep = job.timestep ?? UNGROUPED_TIMESTEP;
                const frameJobs = frameMap.get(timestep);

                if (frameJobs) {
                    frameJobs.push(job);
                    continue;
                }
                frameMap.set(timestep, [job]);
            }

            const frameGroups: FrameJobGroup[] = [];
            for (const [timestep, frameJobs] of frameMap.entries()) {
                frameGroups.push({
                    timestep,
                    jobs: frameJobs,
                    overallStatus: this.computeFrameStatus(frameJobs)
                });
            }

            frameGroups.sort((a, b) => compareFrameTimesteps(a.timestep, b.timestep));

            groups.push({
                trajectoryId,
                trajectoryName: trajectoryJobs[0].trajectoryName as string,
                frameGroups,
                latestTimestamp: this.resolveLatestTimestamp(trajectoryJobs) ?? SAFE_FALLBACK_GROUP_TIMESTAMP,
                overallStatus: this.computeFrameStatus(trajectoryJobs),
                completedCount: trajectoryJobs.filter((job) => job.status === JobStatus.Completed).length,
                totalCount: trajectoryJobs.length
            });
        }

        groups.sort((left, right) => this.compareTimestampValues(
            parseTimestamp(right.latestTimestamp),
            parseTimestamp(left.latestTimestamp)
        ) || left.trajectoryId.localeCompare(right.trajectoryId));

        return groups;
    }

    private resolveLatestTimestamp(jobs: TeamJobSummary[]): string | undefined {
        let latestJob: TeamJobSummary | undefined;

        for (const job of jobs) {
            if (!latestJob || this.compareJobsForDisplay(job, latestJob) < 0) {
                latestJob = job;
            }
        }

        return latestJob ? this.resolveJobTimestamp(latestJob) : undefined;
    }

    private compareJobsForDisplay(left: TeamJobSummary, right: TeamJobSummary): number {
        const timestampComparison = this.compareTimestampValues(
            parseTimestamp(this.resolveJobTimestamp(right)),
            parseTimestamp(this.resolveJobTimestamp(left))
        );

        if (timestampComparison !== 0) {
            return timestampComparison;
        }

        const clusterComparison = (left.teamClusterId ?? '').localeCompare(right.teamClusterId ?? '');
        if (clusterComparison !== 0) {
            return clusterComparison;
        }

        return left.jobId.localeCompare(right.jobId);
    }

    private resolveJobTimestamp(job: TeamJobSummary): string | undefined {
        for (const candidate of [job.timestamp, job.updatedAt, job.createdAt]) {
            if (parseTimestamp(candidate) !== undefined) {
                return candidate;
            }
        }

        return undefined;
    }

    private compareTimestampValues(left?: number, right?: number): number {
        if (left !== undefined && right !== undefined) {
            return left - right;
        }

        if (left !== undefined) {
            return 1;
        }

        if (right !== undefined) {
            return -1;
        }

        return 0;
    }

    /**
     * The status of a set of jobs taken together — a frame, or a whole trajectory.
     *
     * Kept identical to `computeGroupStatus` in the client's
     * `modules/jobs/utils/job-status-semantics`, which is what the browser applies to
     * its own optimistic socket patches. `QueuedAfterFailure` was missing here, so a
     * frame in that state was reported as `partial` by the server and as `queued` by
     * the client patch — the same frame changing colour depending on whether the page
     * had reloaded since.
     */
    private computeFrameStatus(jobs: TeamJobSummary[]): TeamJobStatus {
        const hasRunning = jobs.some((job) => job.status === JobStatus.Running);
        const hasQueued = jobs.some((job) => job.status === JobStatus.Queued
            || job.status === JobStatus.Retrying
            || job.status === JobStatus.QueuedAfterFailure);
        const hasFailed = jobs.some((job) => job.status === JobStatus.Failed);
        const allCompleted = jobs.every((job) => job.status === JobStatus.Completed);

        if (hasRunning) return JobStatus.Running;
        if (hasQueued) return JobStatus.Queued;
        if (allCompleted) return JobStatus.Completed;
        if (hasFailed && jobs.filter((job) => job.status === JobStatus.Completed).length === 0) return JobStatus.Failed;
        return 'partial';
    }

    private async getProjectedTeamJobsRevision(teamId: string): Promise<number> {
        const revision = Number(await getKeyValueStore().get(projectedTeamJobsRevisionKey(teamId)));

        return Number.isFinite(revision) && revision >= 0 ? revision : 0;
    }
};
