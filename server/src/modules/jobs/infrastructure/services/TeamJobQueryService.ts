import { inject, injectable } from 'tsyringe';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import type { TeamJobSnapshot, TeamJobStatus } from '@modules/jobs/domain/entities/TeamJobSnapshot';
import { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class TeamJobQueryService {
    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry
    ) {}

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSnapshot[]> {
        try {
            const jobIds = await this.jobRepository.getTeamJobIds(teamId);

            if (jobIds.length === 0) {
                return [];
            }

            const queuePrefixes = this.queueRegistry.getAllStatusKeyPrefixes();

            if (queuePrefixes.length === 0) {
                logger.warn('[TeamJobQueryService] No queues registered in QueueRegistry');
                return [];
            }

            const statusKeys = queuePrefixes.flatMap((prefix) =>
                jobIds.map((jobId) => `${prefix}${jobId}`)
            );

            const jobStatuses = await this.jobRepository.getJobStatuses(statusKeys);
            const jobsById = new Map<string, TeamJobSnapshot>();

            for (const jobStatus of jobStatuses) {
                if (!this.isTeamJobSnapshot(jobStatus)) {
                    continue;
                }

                if (jobStatus.teamId !== teamId) {
                    continue;
                }

                jobsById.set(jobStatus.jobId, jobStatus);
            }

            return Array.from(jobsById.values());
        } catch (error) {
            logger.error(error, '[TeamJobQueryService] Error fetching team jobs');
            return [];
        }
    }

    private isTeamJobSnapshot(job: Record<string, unknown> | null): job is TeamJobSnapshot {
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
}
