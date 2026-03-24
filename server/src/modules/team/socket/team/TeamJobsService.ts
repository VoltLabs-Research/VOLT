import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import IORedis from 'ioredis';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const SAFE_FALLBACK_GROUP_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const TEAM_JOBS_INITIAL_CACHE_TTL_MS = 2_000;
const UNGROUPED_TIMESTEP = -1;

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

interface DaemonTeamJobsResponse {
    data: TeamJobSummary[];
};

interface TeamJobsInitialCacheEntry {
    expiresAt: number;
    groupedJobsPromise?: Promise<TrajectoryJobGroup[]>;
    groupedJobsValue?: TrajectoryJobGroup[];
};

@injectable()
export default class TeamJobsService {
    private readonly teamJobsInitialCache = new Map<string, TeamJobsInitialCacheEntry>();

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ) { }

    async getTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
        return this.groupJobsByTrajectory(await this.getFlatTeamJobs(teamId));
    }

    async getInitialTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
        const cachedEntry = this.teamJobsInitialCache.get(teamId);
        const now = Date.now();

        if (cachedEntry?.groupedJobsValue && cachedEntry.expiresAt > now) {
            logger.debug({ action: 'team.jobs.initial.cache-hit', teamId }, 'Serving cached initial team jobs');
            return cachedEntry.groupedJobsValue;
        }

        if (cachedEntry?.groupedJobsPromise && cachedEntry.expiresAt > now) {
            logger.debug({ action: 'team.jobs.initial.cache-hit', teamId, source: 'in-flight' }, 'Joining in-flight initial team jobs request');
            return cachedEntry.groupedJobsPromise;
        }

        logger.debug({ action: 'team.jobs.initial.cache-miss', teamId }, 'Refreshing initial team jobs cache');

        const groupedJobsPromise = this.getTeamJobs(teamId)
            .then((groupedJobs) => {
                this.teamJobsInitialCache.set(teamId, {
                    expiresAt: Date.now() + TEAM_JOBS_INITIAL_CACHE_TTL_MS,
                    groupedJobsValue: groupedJobs
                });

                return groupedJobs;
            })
            .catch((error: unknown) => {
                this.teamJobsInitialCache.delete(teamId);
                throw error;
            });

        this.teamJobsInitialCache.set(teamId, {
            expiresAt: now + TEAM_JOBS_INITIAL_CACHE_TTL_MS,
            groupedJobsPromise
        });

        return groupedJobsPromise;
    }

    invalidateInitialTeamJobs(teamId?: string): void {
        if (teamId) {
            this.teamJobsInitialCache.delete(teamId);
            return;
        }

        this.teamJobsInitialCache.clear();
    }

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const [clusterJobs, projectedJobs] = await Promise.all([
            this.getClusterTeamJobs(teamId),
            this.getProjectedTeamJobs(teamId)
        ]);

        const mergedJobs = this.mergeVisibleTeamJobs(clusterJobs, projectedJobs);
        const enrichedJobs = await this.enrichTrajectoryNames(mergedJobs);

        return enrichedJobs.sort((left, right) => this.compareJobsForDisplay(left, right));
    }

    private async getClusterTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const teamClusters = await this.teamClusterRepository.findAll({
            filter: {
                team: teamId,
                status: TeamClusterStatus.Connected
            },
            page: 1,
            limit: 100
        });

        const jobs: TeamJobSummary[] = [];
        const responses = await Promise.all(teamClusters.data.map(async (teamCluster) => {
            try {
                const response = await this.teamClusterDaemonClient.command<DaemonTeamJobsResponse>(
                    teamCluster.id,
                    TEAM_CLUSTER_DAEMON_COMMAND.jobs.list,
                    {
                        teamId
                    },
                    {
                        timeoutClass: 'interactive',
                        timeoutMs: 5_000
                    }
                );

                return {
                    teamClusterId: teamCluster.id,
                    jobs: response.data || []
                };
            } catch (error: unknown) {
                logger.warn({
                    action: 'team.jobs.cluster-fetch-failed',
                    teamId,
                    teamClusterId: teamCluster.id,
                    err: error
                }, 'Failed to fetch jobs from one connected team cluster');

                return null;
            }
        }));

        for (const response of responses) {
            if (!response) {
                continue;
            }

            for (const job of response.jobs) {
                if (this.isTeamJobSummary(job)) {
                    jobs.push({
                        ...job,
                        teamClusterId: response.teamClusterId,
                        source: 'daemon'
                    });
                }
            }
        }

        return jobs;
    }

    private async getProjectedTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const jobIds = await this.redis.smembers(`team:${teamId}:jobs`);
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
            this.redis.srem(`team:${teamId}:jobs`, ...staleJobIds).catch((error) => {
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

    private mergeVisibleTeamJobs(clusterJobs: TeamJobSummary[], projectedJobs: TeamJobSummary[]): TeamJobSummary[] {
        const jobsById = new Map<string, TeamJobSummary>();
        const clusterJobsById = this.indexJobsById(clusterJobs);
        const projectedJobsById = this.indexJobsById(projectedJobs);
        const jobIds = new Set<string>([
            ...clusterJobsById.keys(),
            ...projectedJobsById.keys()
        ]);

        for (const jobId of jobIds) {
            const clusterJob = clusterJobsById.get(jobId);
            const projectedJob = projectedJobsById.get(jobId);

            if (clusterJob && projectedJob) {
                const primaryJob = this.compareJobsForFreshness(clusterJob, projectedJob) <= 0
                    ? clusterJob
                    : projectedJob;
                const secondaryJob = primaryJob === clusterJob ? projectedJob : clusterJob;

                jobsById.set(jobId, this.mergeTeamJob(primaryJob, secondaryJob));
                continue;
            }

            if (clusterJob) {
                jobsById.set(jobId, clusterJob);
                continue;
            }

            if (projectedJob) {
                jobsById.set(jobId, projectedJob);
            }
        }

        return Array.from(jobsById.values());
    }

    private mergeTeamJob(primaryJob: TeamJobSummary, secondaryJob: TeamJobSummary): TeamJobSummary {
        return {
            ...secondaryJob,
            ...primaryJob,
            metadata: {
                ...(secondaryJob.metadata ?? {}),
                ...(primaryJob.metadata ?? {})
            },
            source: primaryJob.source === secondaryJob.source ? primaryJob.source : 'merged'
        };
    }

    private indexJobsById(jobs: TeamJobSummary[]): Map<string, TeamJobSummary> {
        const jobsById = new Map<string, TeamJobSummary>();

        const sortedJobs = [...jobs].sort((left, right) => this.compareJobsForFreshness(left, right));

        for (const job of sortedJobs) {
            if (!jobsById.has(job.jobId)) {
                jobsById.set(job.jobId, job);
            }
        }

        return jobsById;
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

        const sourceComparison = this.compareSourcePriority(left.source, right.source);
        if (sourceComparison !== 0) {
            return sourceComparison;
        }

        const clusterComparison = (left.teamClusterId ?? '').localeCompare(right.teamClusterId ?? '');
        if (clusterComparison !== 0) {
            return clusterComparison;
        }

        return left.jobId.localeCompare(right.jobId);
    }

    private compareJobsForFreshness(left: TeamJobSummary, right: TeamJobSummary): number {
        const timestampComparison = this.compareTimestampValues(
            this.resolveJobTimestampValue(right),
            this.resolveJobTimestampValue(left)
        );

        if (timestampComparison !== 0) {
            return timestampComparison;
        }

        const completenessComparison = this.getJobCompletenessScore(right) - this.getJobCompletenessScore(left);
        if (completenessComparison !== 0) {
            return completenessComparison;
        }

        const displayComparison = this.compareJobsForDisplay(left, right);
        if (displayComparison !== 0) {
            return displayComparison;
        }

        return left.status.localeCompare(right.status);
    }

    private compareSourcePriority(left?: TeamJobSource, right?: TeamJobSource): number {
        return this.getSourcePriority(right) - this.getSourcePriority(left);
    }

    private getSourcePriority(source?: TeamJobSource): number {
        if (source === 'daemon') {
            return 2;
        }

        if (source === 'merged') {
            return 3;
        }

        if (source === 'projected') {
            return 1;
        }

        return 0;
    }

    private getJobCompletenessScore(job: TeamJobSummary): number {
        const fields: Array<unknown> = [
            job.name,
            job.sessionId,
            job.message,
            job.metadata,
            job.timestamp,
            job.updatedAt,
            job.createdAt,
            job.analysisId,
            job.trajectoryId,
            job.trajectoryName,
            job.timestep,
            job.teamClusterId,
            job.source
        ];

        let score = 0;

        for (const field of fields) {
            if (typeof field !== 'undefined') {
                score += 1;
            }
        }

        return score;
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
};
