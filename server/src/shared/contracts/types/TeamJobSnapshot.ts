/**
 * Neutral cross-module contract for a team job snapshot and its derived status.
 *
 * Extracted from `@modules/jobs/domain/contracts/TeamJobSnapshot` during the
 * detachable-modules migration: the `team` module's socket projection
 * (`TeamJobsService`) consumes these TYPES, so hosting them here lets it drop
 * its `@modules/jobs` import. Pure types — the only dependency is the neutral
 * `JobStatus` enum from the contracts layer. The original owner file re-exports
 * both names, so existing importers compile unchanged.
 */
import type { JobStatus } from '@shared/contracts/types/JobStatus';

export type TeamJobStatus = JobStatus | 'partial';

export interface TeamJobSnapshot {
    jobId: string;
    name?: string;
    teamId: string;
    teamClusterId?: string;
    queueType: string;
    status: TeamJobStatus;
    sessionId?: string;
    message?: string;
    error?: string;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    source?: string;
    backingSource?: string;
    cleanupScope?: string;
    revision?: number;
    [key: string]: unknown;
}
