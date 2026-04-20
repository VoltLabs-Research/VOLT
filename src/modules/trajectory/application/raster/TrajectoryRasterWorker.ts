import { type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import type { QueueService } from '@/core/queues/application/QueueService';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { ObjectBucketName, type RasterQueueJobPayload } from '@/contracts';
import { isRecord } from '@/support/type-guards/is-record';
import { logAndSwallow } from '@/support/error/errorMessage';
import type { Rasterizer } from '@/modules/trajectory/application/raster/Rasterizer';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

@Service('trajectoryRasterWorker')
export class TrajectoryRasterWorker extends BaseWorker<RasterQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_RASTER_QUEUE_NAME;
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<RasterQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore,
        private readonly rasterizer: Rasterizer,
        daemonJobReporter: DaemonJobReporter
    ) {
        super({ queueService });
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
        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
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
