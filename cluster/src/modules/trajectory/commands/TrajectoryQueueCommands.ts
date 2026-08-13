import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import type {
    EnqueuePreprocessingRequest,
    EnqueuePreprocessingResponse,
    GlbConversionQueueJobPayload,
    TrajectoryRuntimeCleanupRequest
} from '@shared/contracts/types/queue-trajectory';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { logger } from '@shared/infrastructure/logger';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@core/constants/queue-names';
import { RuntimeStateCleanupControl, getRuntimeStateCleanupControl } from '@modules/jobs/services/RuntimeStateCleanupControl';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_TRAJECTORY_GLB_JOB_ATTEMPTS = readPositiveIntegerEnv('TRAJECTORY_GLB_JOB_ATTEMPTS') ?? 3;
const DEFAULT_TRAJECTORY_GLB_JOB_BACKOFF_MS = readPositiveIntegerEnv('TRAJECTORY_GLB_JOB_BACKOFF_MS') ?? 2000;

@CommandGroup('trajectory')
export class TrajectoryQueueCommands {
    constructor(
        private readonly queueService: QueueService,
        private readonly runtimeStateCleanupControl: RuntimeStateCleanupControl
    ) {}

    @Command('enqueue-preprocessing')
    async enqueuePreprocessing(payload: EnqueuePreprocessingRequest) {
        const result: EnqueuePreprocessingResponse = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0
        };
        const jobsToEnqueue: GlbConversionQueueJobPayload[] = [];

        for (const frame of payload.frames) {
            const ownerClusterId = frame.ownerClusterId || payload.storageClusterId;

            if (!ownerClusterId) {
                logger.debug(
                    {
                        objectKey: frame.objectKey,
                        timestep: frame.timestep,
                        trajectoryId: payload.trajectoryId
                    },
                    'Skipping GLB enqueue — dump owner cluster is missing'
                );
                result.skippedJobs += 1;
                continue;
            }

            const timestamp = new Date().toISOString();
            jobsToEnqueue.push({
                jobId: `trajectory-glb:${payload.trajectoryId}:${frame.timestep}`,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                timestep: frame.timestep,
                objectKey: frame.objectKey,
                ownerClusterId,
                status: 'queued',
                queueType: TRAJECTORY_GLB_QUEUE_NAME,
                metadata: {
                    trajectoryId: payload.trajectoryId,
                    timestep: frame.timestep
                },
                createdAt: timestamp,
                updatedAt: timestamp
            });
        }

        if (jobsToEnqueue.length > 0) {
            await this.queueService.enqueueBulk(TRAJECTORY_GLB_QUEUE_NAME, jobsToEnqueue, {
                attempts: DEFAULT_TRAJECTORY_GLB_JOB_ATTEMPTS,
                backoff: {
                    type: 'exponential',
                    delay: DEFAULT_TRAJECTORY_GLB_JOB_BACKOFF_MS
                }
            });
            result.queuedJobs = jobsToEnqueue.length;
        }

        return result;
    }

    @Command('cleanup-runtime-state')
    cleanupRuntimeState(payload: TrajectoryRuntimeCleanupRequest) {
        return this.runtimeStateCleanupControl.cleanupTrajectoryRuntimeState(payload);
    }
}

export const getTrajectoryQueueCommands = commandGroupFactory(TrajectoryQueueCommands, () => new TrajectoryQueueCommands(getQueueService(), getRuntimeStateCleanupControl()));
