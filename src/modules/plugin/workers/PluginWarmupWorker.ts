import { toError } from '@shared/application/utilities/error-message';
import { singleton } from '@shared/application/utilities/singleton';
import { getPluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import { logger } from '@shared/infrastructure/logger';
import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { QueueService, type QueuePayload, getQueueService } from '@shared/infrastructure/queues/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@core/constants/queue-names';
import type { PluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import type { Job } from 'bullmq';

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

    protected async process(payload: PluginWarmupJobPayload, bullJob: Job<PluginWarmupJobPayload>): Promise<void> {
        logger.info(
            {
                pluginId: payload.pluginId,
                bullJobId: bullJob.id
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

export const getPluginWarmupWorker = singleton((): PluginWarmupWorker => new PluginWarmupWorker(getQueueService(), getPluginBinaryCache()));
