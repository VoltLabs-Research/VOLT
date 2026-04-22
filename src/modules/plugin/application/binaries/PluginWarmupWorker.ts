import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { QueueService, type QueuePayload } from '@/core/queues/application/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import type { Job } from 'bullmq';

export interface PluginWarmupJobPayload extends QueuePayload {
    pluginId: string;
    binaryObjectPath: string;
    requirementsFile: string;
    entrypointScript?: string;
}

const DEFAULT_WARMUP_CONCURRENCY = 2;

@Service('pluginWarmupWorker')
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

    protected async process(payload: PluginWarmupJobPayload, bullJob: Job<PluginWarmupJobPayload>): Promise<void> {
        logger.info(
            { pluginId: payload.pluginId, bullJobId: bullJob.id },
            '@plugin-warmup-worker: starting plugin warmup'
        );
        try {
            const descriptor = await this.pluginBinaryCache.warmUpPlugin({
                pluginId: payload.pluginId,
                binaryObjectPath: payload.binaryObjectPath,
                requirementsFile: payload.requirementsFile,
                entrypointScript: payload.entrypointScript
            });
            logger.info(
                { pluginId: payload.pluginId, descriptor },
                '@plugin-warmup-worker: plugin warm image published'
            );
        } catch (error: unknown) {
            logger.error(
                { err: error, pluginId: payload.pluginId },
                '@plugin-warmup-worker: warmup failed'
            );
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
}
