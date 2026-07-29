import { logger } from '@shared/infrastructure/logger';
import { errorMessage } from '@shared/application/utilities/error-message';
import type { Failed, JobIdentity } from '@shared/contracts/types/job-identity';
import type { JobLifecycleStatus } from '@shared/infrastructure/queues/with-job-lifecycle';

export interface StatusReporterTriple<P> {
    started: (payload: P) => Promise<void>;
    completed: (payload: P) => Promise<void>;
    failed: (payload: Failed<P>) => Promise<void>;
}

export const createLifecycleStatusReporter = <P extends JobIdentity>(
    triple: StatusReporterTriple<P>,
    kind: string
) => (payload: P) => (status: JobLifecycleStatus, error?: string): void => {
    const promise =
        status === 'started' ? triple.started(payload)
        : status === 'completed' ? triple.completed(payload)
        : triple.failed({
            ...payload,
            error: error ?? 'Unknown error'
        } as Failed<P>);

    promise.catch((err: unknown) => {
        logger.error(
            {
                err,
                jobId: payload.jobId,
                status,
                trajectoryId: payload.trajectoryId
            },
            `Failed to report ${kind} job ${status} status: ${errorMessage(err)}`
        );
    });
};
