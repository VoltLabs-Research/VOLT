import { singleton } from '@shared/utilities/singleton';
import type { WorkerBinding } from '@shared/queues/worker-registry';
import { getQueueService } from '@shared/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { getTrajectoryAutoPreviewClaimStore } from '@modules/trajectory/services/storage/TrajectoryAutoPreviewClaimStore';
import { getRasterizer } from '@modules/trajectory/services/raster/Rasterizer';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { QueueJobHandle } from '@shared/queues/queue-job-handle';

import { BaseWorker } from '@shared/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/queues/create-status-reporter';
import type { QueueService } from '@shared/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { isFinalAttempt, withJobLifecycle } from '@shared/queues/with-job-lifecycle';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { type RasterQueueJobPayload } from '@shared/contracts/types/queue-trajectory';
import { logAndSwallow } from '@shared/utilities/error-message';
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
        super({
            queueService,
            scopeLimitsRegistry: queueScopeLimitsRegistry
        });
        this.buildStatusReporter = createLifecycleStatusReporter<RasterQueueJobPayload>(
            {
                started: daemonJobReporter.reportRasterStarted,
                completed: daemonJobReporter.reportRasterCompleted,
                failed: daemonJobReporter.reportRasterFailed
            },
            'trajectory raster'
        );
    }

    protected async process(payload: RasterQueueJobPayload, job: QueueJobHandle<RasterQueueJobPayload>): Promise<void> {
        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(job),
                cleanup: async ({ reachedTerminal }) => {
                    if (reachedTerminal && payload.metadata.autoPreview) {
                        await this.trajectoryAutoPreviewClaimStore
                            .releaseRasterization(payload.trajectoryId)
                            .catch(logAndSwallow('error',
                                {
                                    jobId: payload.jobId,
                                    trajectoryId: payload.trajectoryId
                                },
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

export const trajectoryRasterWorker: WorkerBinding = {
    name: 'trajectory-raster',
    scope: 'always',
    concurrencyKey: 'rasterizer',
    tracksConcurrencyWhileRunning: true,
    resolve: singleton((): TrajectoryRasterWorker => new TrajectoryRasterWorker(getQueueService(), getQueueScopeLimitsRegistry(), getTrajectoryAutoPreviewClaimStore(), getRasterizer(), getDaemonJobReporter()))
};
