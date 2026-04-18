import { DelayedError, type Job } from 'bullmq';

import { logger } from '@/core/logger';
import { BaseWorker, type QueueScopeConstraint } from '@/core/queues/application/BaseWorker';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import type { GlbConversionQueueJobPayload } from '@/contracts';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

export class TrajectoryGlbWorker extends BaseWorker<GlbConversionQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_GLB_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        redisConnection: RedisConnection,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly glbExporter: GlbExporter,
        private readonly daemonJobReporter: DaemonJobReporter
    ) {
        super({ queueService, redisConnection });
    }

    protected scopeConstraints(payload: GlbConversionQueueJobPayload): QueueScopeConstraint[] {
        const limits = this.queueScopeLimitsRegistry.getSnapshot().trajectoryGlbConversion;
        return [
            { scope: 'trajectory', scopeId: payload.trajectoryId, limit: limits.maxRunningPerTrajectory },
            { scope: 'team', scopeId: payload.teamId, limit: limits.maxRunningPerTeam }
        ];
    }

    protected async process(payload: GlbConversionQueueJobPayload, bullJob: Job<GlbConversionQueueJobPayload>): Promise<void> {
        this.reportStatus(payload, 'started');

        try {
            await bullJob.updateProgress(10);
            await this.glbExporter.preprocessTrajectory({
                trajectoryId: payload.trajectoryId,
                timestep: payload.timestep,
                objectKey: payload.objectKey,
                ownerClusterId: payload.ownerClusterId,
                teamId: payload.teamId
            });
            await bullJob.updateProgress(100);

            this.reportStatus(payload, 'completed');
        } catch (error) {
            if (error instanceof DelayedError || !(error instanceof Error)) {
                throw error;
            }

            this.reportStatus(payload, 'failed', error.message);
            throw error;
        }
    }

    private reportStatus(
        payload: GlbConversionQueueJobPayload,
        status: 'started' | 'completed' | 'failed',
        error?: string
    ): void {
        const base = {
            jobId: payload.jobId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            timestep: payload.timestep
        };

        let promise: Promise<void>;
        switch(status){
            case 'started':
                promise = this.daemonJobReporter.reportGlbStarted(base);
                break;
            
            case 'completed':
                promise = this.daemonJobReporter.reportGlbCompleted(base);
                break;
            
            case 'failed':
                promise = this.daemonJobReporter.reportGlbFailed({ ...base, error: error! });
                break;
        }

        promise.catch((reportError) => {
            logger.error(
                { err: reportError, jobId: payload.jobId, status, trajectoryId: payload.trajectoryId },
                'Failed to report trajectory GLB job status'
            );
        });
    }
}
