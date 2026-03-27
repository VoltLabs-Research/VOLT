import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import IORedis from 'ioredis';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const SAFE_FALLBACK_GROUP_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const UNGROUPED_TIMESTEP = -1;
const MAX_INITIAL_SNAPSHOT_ATTEMPTS = 5;

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

type TeamJobStatus = JobStatus | 'retrying' | 'partial';
type TeamJobSource = 'daemon' | 'projected' | 'merged';

interface TeamJobMetadata {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number | string;
    analysisId?: string;
    message?: string;
    [key: string]: unknown;
};

interface TeamJobStatusRecord {
    jobId: string;
    name?: string;
    teamId?: string;
    queueType?: string;
    status?: TeamJobStatus;
    sessionId?: string;
    message?: string;
    metadata?: TeamJobMetadata;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    teamClusterId?: string;
    source?: TeamJobSource;
    revision?: number;
};

export interface TeamJobSummary extends TeamJobStatusRecord {
    jobId: string;
    queueType: string;
    status: TeamJobStatus;
    teamId: string;
    [key: string]: unknown;
};

interface GroupedTeamJobSummary extends TeamJobSummary {
    trajectoryId: string;
    trajectoryName: string;
};

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

@injectable()
export default class TeamJobsService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ) { }

    async getTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
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

    invalidateInitialTeamJobs(_teamId?: string): void {}

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const projectedJobs = await this.getProjectedTeamJobs(teamId);
        const enrichedJobs = await this.enrichTrajectoryNames(projectedJobs);

        return enrichedJobs.sort((left, right) => this.compareJobsForDisplay(left, right));
    }

    private async getProjectedTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const jobIds = await this.redis.smembers(this.projectedTeamJobsKey(teamId));
        if (jobIds.length === 0) {
            return [];
        }

        const records = await this.redis.mget(jobIds.map((jobId) => `${JOB_STATUS_KEY_PREFIX}${jobId}`));
        const jobs: TeamJobSummary[] = [];
        const staleJobIds: string[] = [];

        for (const [index, record] of records.entries()) {
            if (!record) {
                if (jobIds[index]) {
                    staleJobIds.push(jobIds[index]);
                }
                continue;
            }

            try {
                const parsed = JSON.parse(record) as Record<string, unknown> | null;
                if (this.isTeamJobSummary(parsed)) {
                    jobs.push({
                        ...parsed,
                        source: 'projected'
                    });
                }
            } catch (error) {
                logger.warn({ err: error }, 'Failed to parse projected team job record');
            }
        }

        if (staleJobIds.length > 0) {
            this.redis.srem(this.projectedTeamJobsKey(teamId), ...staleJobIds).catch((error) => {
                logger.warn({ err: error, staleJobCount: staleJobIds.length, teamId }, 'Failed to prune stale projected team jobs');
            });
        }

        return jobs;
    }

    private groupJobsByTrajectory(jobs: TeamJobSummary[]): TrajectoryJobGroup[] {
        const trajectoryMap = new Map<string, GroupedTeamJobSummary[]>();

        for (const job of jobs) {
            const trajectoryId = this.resolveTrajectoryId(job);

            if (!trajectoryId) {
                continue;
            }

            let trajectoryName = this.resolveTrajectoryName(job);
            if (typeof trajectoryName !== 'string' || trajectoryName.trim().length === 0) {
                logger.warn({
                    action: 'team.jobs.missing-trajectory-name',
                    jobId: job.jobId,
                    teamId: job.teamId,
                    trajectoryId,
                    teamClusterId: job.teamClusterId,
                    source: job.source
                }, 'Missing trajectory name for team job; using trajectory id as fallback');
                trajectoryName = trajectoryId;
            }

            if (!trajectoryMap.has(trajectoryId)) {
                trajectoryMap.set(trajectoryId, []);
            }

            trajectoryMap.get(trajectoryId)?.push({
                ...job,
                trajectoryId,
                trajectoryName
            });
        }

        const groups: TrajectoryJobGroup[] = [];

        for (const [trajectoryId, trajectoryJobs] of trajectoryMap.entries()) {
            const frameMap = new Map<number, GroupedTeamJobSummary[]>();
            const groupedJobs: GroupedTeamJobSummary[] = [];

            for (const job of trajectoryJobs) {
                const timestep = this.resolveJobTimestep(job) ?? UNGROUPED_TIMESTEP;

                if (!frameMap.has(timestep)) {
                    frameMap.set(timestep, []);
                }
                frameMap.get(timestep)?.push(job);
                groupedJobs.push(job);
            }

            if (groupedJobs.length === 0) {
                continue;
            }

            const frameGroups: FrameJobGroup[] = [];
            for (const [timestep, jobs] of frameMap.entries()) {
                const overallStatus = this.computeFrameStatus(jobs);
                frameGroups.push({
                    timestep,
                    jobs,
                    overallStatus
                });
            }

            frameGroups.sort((a, b) => compareFrameTimesteps(a.timestep, b.timestep));

            const allJobs = groupedJobs;
            const overallStatus = this.computeFrameStatus(allJobs);
            const completedCount = allJobs.filter((job) => job.status === JobStatus.Completed).length;
            const trajectoryName = groupedJobs[0].trajectoryName;

            const latestTimestamp = this.resolveLatestTimestamp(groupedJobs) ?? SAFE_FALLBACK_GROUP_TIMESTAMP;

            groups.push({
                trajectoryId,
                trajectoryName,
                frameGroups,
                latestTimestamp,
                overallStatus,
                completedCount,
                totalCount: allJobs.length
            });
        }

        // Sort trajectories by latest timestamp descending
        groups.sort((left, right) => this.compareTimestampValues(
            this.parseTimestamp(right.latestTimestamp),
            this.parseTimestamp(left.latestTimestamp)
        ) || left.trajectoryId.localeCompare(right.trajectoryId));

        return groups;
    }

    private async enrichTrajectoryNames(jobs: TeamJobSummary[]): Promise<TeamJobSummary[]> {
        const missingTrajectoryIds = Array.from(new Set(
            jobs
                .filter((job) => !this.resolveTrajectoryName(job))
                .map((job) => this.resolveTrajectoryId(job))
                .filter((trajectoryId): trajectoryId is string => typeof trajectoryId === 'string' && trajectoryId.length > 0)
        ));

        if (missingTrajectoryIds.length === 0) {
            return jobs;
        }

        const trajectoryNames = new Map<string, string>();
        logger.debug({
            action: 'team.jobs.trajectory-name-batch-enrichment',
            trajectoryCount: missingTrajectoryIds.length,
            jobCount: jobs.length
        }, 'Batch enriching missing trajectory names for team jobs');

        const trajectories = await this.trajectoryRepository.findAll({
            filter: {
                _id: {
                    $in: missingTrajectoryIds
                }
            },
            page: 1,
            limit: missingTrajectoryIds.length,
            select: ['name']
        });

        for (const trajectory of trajectories.data) {
            if (trajectory.props.name) {
                trajectoryNames.set(trajectory.id, trajectory.props.name);
            }
        }

        return jobs.map((job) => {
            if (this.resolveTrajectoryName(job)) {
                return job;
            }

            const trajectoryId = this.resolveTrajectoryId(job);
            if (!trajectoryId) {
                return job;
            }

            const trajectoryName = trajectoryNames.get(trajectoryId);
            if (!trajectoryName) {
                return job;
            }

            return {
                ...job,
                trajectoryId,
                trajectoryName,
                metadata: {
                    ...job.metadata,
                    trajectoryId,
                    trajectoryName
                }
            };
        });
    }

    private resolveTrajectoryId(job: TeamJobSummary): string | undefined {
        if (typeof job.trajectoryId === 'string') {
            return job.trajectoryId;
        }

        if (typeof job.metadata?.trajectoryId === 'string') {
            return job.metadata.trajectoryId;
        }

        return undefined;
    }

    private resolveTrajectoryName(job: TeamJobSummary): string | undefined {
        if (typeof job.trajectoryName === 'string') {
            return job.trajectoryName;
        }

        if (typeof job.metadata?.trajectoryName === 'string') {
            return job.metadata.trajectoryName;
        }

        return undefined;
    }

    private resolveJobTimestep(job: TeamJobSummary): number | undefined {
        if (typeof job.timestep === 'number' && Number.isFinite(job.timestep)) {
            return job.timestep;
        }

        if (typeof job.metadata?.timestep === 'number' && Number.isFinite(job.metadata.timestep)) {
            return job.metadata.timestep;
        }

        if (typeof job.metadata?.timestep === 'string' && job.metadata.timestep.trim().length > 0) {
            const parsedTimestep = Number(job.metadata.timestep);
            if (Number.isFinite(parsedTimestep)) {
                return parsedTimestep;
            }
        }

        return undefined;
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
            this.resolveJobTimestampValue(right),
            this.resolveJobTimestampValue(left)
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
        const candidates = [job.timestamp, job.updatedAt, job.createdAt];

        for (const candidate of candidates) {
            if (typeof candidate !== 'string' || candidate.trim().length === 0) {
                continue;
            }

            if (typeof this.parseTimestamp(candidate) === 'number') {
                return candidate;
            }
        }

        return undefined;
    }

    private resolveJobTimestampValue(job: TeamJobSummary): number | undefined {
        const timestamp = this.resolveJobTimestamp(job);

        return timestamp ? this.parseTimestamp(timestamp) : undefined;
    }

    private parseTimestamp(timestamp?: string): number | undefined {
        if (typeof timestamp !== 'string' || timestamp.trim().length === 0) {
            return undefined;
        }

        const parsedTimestamp = Date.parse(timestamp);

        return Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined;
    }

    private compareTimestampValues(left?: number, right?: number): number {
        if (typeof left === 'number' && typeof right === 'number') {
            return left - right;
        }

        if (typeof left === 'number') {
            return 1;
        }

        if (typeof right === 'number') {
            return -1;
        }

        return 0;
    }

    private computeFrameStatus(jobs: TeamJobSummary[]): TeamJobStatus {
        const hasRunning = jobs.some((job) => job.status === JobStatus.Running);
        const hasQueued = jobs.some((job) => job.status === JobStatus.Queued || job.status === 'retrying');
        const hasFailed = jobs.some((job) => job.status === JobStatus.Failed);
        const allCompleted = jobs.every((job) => job.status === JobStatus.Completed);

        if (hasRunning) return JobStatus.Running;
        if (hasQueued) return JobStatus.Queued;
        if (allCompleted) return JobStatus.Completed;
        if (hasFailed && jobs.filter((job) => job.status === JobStatus.Completed).length === 0) return JobStatus.Failed;
        return 'partial';
    }

    private isTeamJobSummary(job: Record<string, unknown> | null): job is TeamJobSummary {
        return Boolean(
            job
            && typeof job.jobId === 'string'
            && typeof job.teamId === 'string'
            && typeof job.queueType === 'string'
            && this.isTeamJobStatus(job.status)
        );
    }

    private isTeamJobStatus(status: unknown): status is TeamJobStatus {
        return status === JobStatus.Queued
            || status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed
            || status === 'retrying'
            || status === 'partial';
    }

    private async getProjectedTeamJobsRevision(teamId: string): Promise<number> {
        const revision = await this.redis.get(this.projectedTeamJobsRevisionKey(teamId));
        const parsedRevision = Number(revision);

        return Number.isFinite(parsedRevision) && parsedRevision >= 0
            ? parsedRevision
            : 0;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedTeamJobsRevisionKey(teamId: string): string {
        return `team:${teamId}:projected-jobs:revision`;
    }
};
