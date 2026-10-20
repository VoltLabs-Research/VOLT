import { toError } from '@shared/utilities/error-message';
import type { WorkerBinding } from '@shared/queues/worker-registry';
import { singleton } from '@shared/utilities/singleton';
import { getPluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import { logger } from '@shared/logger';
import { BaseWorker } from '@shared/queues/BaseWorker';
import { QueueService, type QueuePayload, getQueueService } from '@shared/queues/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@core/constants/queue-names';
import type { PluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import type { QueueJobHandle } from '@shared/queues/queue-job-handle';

export interface PluginWarmupJobPayload extends QueuePayload {
    pluginId: string;
    binaryObjectPath: string;
    ownerClusterId?: string;
    requirementsFile: string;
    entrypointScript?: string;
}

const DEFAULT_WARMUP_CONCURRENCY = 2;

export class PluginWarmupWorker extends BaseWorker<PluginWarmupJobPayload> {
    protected readonly queueName = PLUGIN_WARMUP_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        private readonly pluginBinaryCache: PluginBinaryCache
    ) {
        super({ queueService });
    }

    start(concurrency: number = DEFAULT_WARMUP_CONCURRENCY): void {
        super.start(concurrency);
    }

    protected async process(payload: PluginWarmupJobPayload, job: QueueJobHandle<PluginWarmupJobPayload>): Promise<void> {
        logger.info(
            {
                pluginId: payload.pluginId,
                jobId: job.id
            },
            '@plugin-warmup-worker: starting plugin warmup'
        );
        try {
            const descriptor = await this.pluginBinaryCache.warmUpPlugin({
                pluginId: payload.pluginId,
                binaryObjectPath: payload.binaryObjectPath,
                ownerClusterId: payload.ownerClusterId,
                requirementsFile: payload.requirementsFile,
                entrypointScript: payload.entrypointScript
            });
            logger.info(
                {
                    pluginId: payload.pluginId,
                    descriptor
                },
                '@plugin-warmup-worker: plugin warm image published'
            );
        } catch (error: unknown) {
            logger.error(
                {
                    err: error,
                    pluginId: payload.pluginId
                },
                '@plugin-warmup-worker: warmup failed'
            );
            throw toError(error);
        }
    }
}

export const pluginWarmupWorker: WorkerBinding = {
    name: 'plugin-warmup',
    scope: 'compute',
    concurrencyKey: 'pluginWarmup',
    tracksConcurrencyWhileRunning: true,
    resolve: singleton((): PluginWarmupWorker => new PluginWarmupWorker(getQueueService(), getPluginBinaryCache()))
};
