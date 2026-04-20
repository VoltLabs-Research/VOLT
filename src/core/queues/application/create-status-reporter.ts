import { logger } from '@/core/logger';
import { errorMessage } from '@/support/error/errorMessage';
import type { Failed, JobIdentity } from '@/support/contracts/job-identity';
import type { JobLifecycleStatus } from '@/core/queues/application/with-job-lifecycle';

export interface StatusReporterTriple<P> {
    started: (payload: P) => Promise<void>;
    completed: (payload: P) => Promise<void>;
    failed: (payload: Failed<P>) => Promise<void>;
}

/**
 * Build a `reportStatus` callback suitable for `withJobLifecycle` from a
 * started/completed/failed triple of async reporter functions. The returned
 * callback is sync (fire-and-forget); any rejected promise is logged via
 * `logger.error` with the job identifiers.
 */
export const createLifecycleStatusReporter = <P extends JobIdentity>(
    triple: StatusReporterTriple<P>,
    kind: string
) => (payload: P) => (status: JobLifecycleStatus, error?: string): void => {
    const promise =
        status === 'started' ? triple.started(payload)
        : status === 'completed' ? triple.completed(payload)
        : triple.failed({ ...payload, error: error ?? 'Unknown error' } as Failed<P>);

    promise.catch((err: unknown) => {
        logger.error(
            { err, jobId: payload.jobId, status, trajectoryId: payload.trajectoryId },
            `Failed to report ${kind} job ${status} status: ${errorMessage(err)}`
        );
    });
};
