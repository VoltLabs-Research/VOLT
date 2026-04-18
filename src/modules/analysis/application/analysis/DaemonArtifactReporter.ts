import Bottleneck from 'bottleneck';

import type { EventDispatcher } from '@/core/events/EventDispatcher';
import { logger } from '@/core/logger';
import { SceneArtifactBatchReportedEvent } from '@/modules/plugin/application/events/SceneArtifactBatchReportedEvent';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/contracts/reverse-channel-plugin';

const SCENE_ARTIFACT_BATCH_SIZE = 64;
const SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS = 250;

export class DaemonArtifactReporter {
    private readonly batcher: Bottleneck.Batcher;
    private readonly pendingArtifacts = new Map<string, ReportArtifactInput>();
    private publishQueue: Promise<void> = Promise.resolve();

    constructor(private readonly eventDispatcher: EventDispatcher) {
        this.batcher = new Bottleneck.Batcher({
            maxSize: SCENE_ARTIFACT_BATCH_SIZE,
            maxTime: SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS
        });

        this.batcher.on('batch', (keys: string[]) => {
            const uniqueKeys = [...new Set(keys)];
            const batch: ReportArtifactInput[] = [];

            for (const key of uniqueKeys) {
                const artifact = this.pendingArtifacts.get(key);
                if (!artifact) {
                    continue;
                }

                batch.push(artifact);
                this.pendingArtifacts.delete(key);
            }

            void this.enqueuePublish(batch);
        });
        this.batcher.on('error', (error) => {
            logger.warn(`Artifact batcher error: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    async reportArtifact(input: ReportArtifactInput): Promise<void> {
        this.pendingArtifacts.set(input.objectName, input);
        void this.batcher.add(input.objectName).catch((error) => {
            logger.warn(`Failed to enqueue artifact batch item objectName=${input.objectName}: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    async flushPendingArtifacts(): Promise<void> {
        const batch = Array.from(this.pendingArtifacts.values());
        if (batch.length > 0) {
            this.pendingArtifacts.clear();
            await this.enqueuePublish(batch);
        }

        await this.publishQueue;
    }

    private enqueuePublish(batch: ReportArtifactInput[]): Promise<void> {
        this.publishQueue = this.publishQueue
            .catch(() => undefined)
            .then(async () => {
                if (batch.length === 0) {
                    return;
                }

                try {
                    await this.eventDispatcher.publish(new SceneArtifactBatchReportedEvent({
                        items: batch
                    }));
                } catch (error) {
                    logger.warn(`Failed to flush scene artifact batch event: ${error instanceof Error ? error.message : String(error)}`);
                }
            });

        return this.publishQueue;
    }
}
