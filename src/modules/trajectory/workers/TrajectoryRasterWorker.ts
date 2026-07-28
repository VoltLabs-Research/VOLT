import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getTrajectoryAutoPreviewClaimStore } from '@modules/trajectory/services/storage/TrajectoryAutoPreviewClaimStore';
import { getRasterizer } from '@modules/trajectory/services/raster/Rasterizer';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { type Job } from 'bullmq';

import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';
import { ObjectBucketName, type RasterQueueJobPayload } from '@shared/contracts';
import { isRecord } from '@shared/domain/utilities/is-record';
import { logAndSwallow } from '@shared/application/utilities/error-message';
import type { Rasterizer } from '@modules/trajectory/services/raster/Rasterizer';
import type { TrajectoryAutoPreviewClaimStore } from '@modules/trajectory/services/storage/TrajectoryAutoPreviewClaimStore';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';

export class TrajectoryRasterWorker extends BaseWorker<RasterQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_RASTER_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'trajectoryRasterization';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<RasterQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
        private readonly rasterizer: Rasterizer,
        daemonJobReporter: DaemonJobReporter
    ) {
        super({ queueService, scopeLimitsRegistry: queueScopeLimitsRegistry });
        this.buildStatusReporter = createLifecycleStatusReporter<RasterQueueJobPayload>(
            {
                started: daemonJobReporter.reportRasterStarted,
                completed: daemonJobReporter.reportRasterCompleted,
                failed: daemonJobReporter.reportRasterFailed
            },
            'trajectory raster'
        );
    }

    protected async process(payload: RasterQueueJobPayload, bullJob: Job<RasterQueueJobPayload>): Promise<void> {
        const maxAttempts = bullJob.opts.attempts ?? 1;
        const isFinalAttempt = () => bullJob.attemptsMade + 1 >= maxAttempts;

        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(),
                progress: (value) => bullJob.updateProgress(value),
                cleanup: async ({ reachedTerminal }) => {
                    if (reachedTerminal && isRecord(payload.metadata) && payload.metadata.autoPreview === true) {
                        await this.trajectoryAutoPreviewClaimStore
                            .releaseRasterization(payload.trajectoryId)
                            .catch(logAndSwallow('error',
                                { jobId: payload.jobId, trajectoryId: payload.trajectoryId },
                                'Failed to release trajectory auto-preview claim'));
                    }
                }
            },
            () => this.rasterizer.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: payload.modelObjectKey,
                inputOwnerClusterId: payload.modelOwnerClusterId,
                outputObjectKey: payload.outputObjectKey,
                outputOwnerClusterId: payload.outputOwnerClusterId
            })
        );
    }
}

let trajectoryRasterWorkerInstance: TrajectoryRasterWorker | null = null;

export const getTrajectoryRasterWorker = (): TrajectoryRasterWorker => {
    trajectoryRasterWorkerInstance ??= new TrajectoryRasterWorker(getQueueService(), getQueueScopeLimitsRegistry(), getTrajectoryAutoPreviewClaimStore(), getRasterizer(), getDaemonJobReporter());
    return trajectoryRasterWorkerInstance;
};
