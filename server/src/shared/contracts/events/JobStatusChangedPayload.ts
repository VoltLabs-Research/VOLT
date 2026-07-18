/**
 * Neutral payload contract for the `job.status.changed` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/jobs/events/JobStatusChangedEvent`) so that consumer modules
 * which subscribe to this event can reference the payload TYPE without importing
 * `@modules/jobs`. The event CLASS stays in the jobs module. Pure type — the
 * only dependency is the neutral `JobStatus` enum from the contracts layer.
 */
import type { JobStatus } from '@shared/contracts/types/JobStatus';

export interface JobStatusChangedEventPayload {
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    name?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    message?: string;
    error?: string;
    teamClusterId?: string;
    source?: string;
    backingSource?: string;
    cleanupScope?: string;
    [key: string]: unknown;
}
