import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import Bottleneck from 'bottleneck';

import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { SceneArtifactBatchReportedEvent } from '@modules/plugin/events/plugin-events';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@shared/contracts/channel/reverse-channel-plugin';
import { logAndSwallow, safeExecute } from '@shared/application/utilities/error-message';

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
        this.batcher.on('error', logAndSwallow('warn', {}, 'Artifact batcher error'));
    }

    async reportArtifact(input: ReportArtifactInput): Promise<void> {
        this.pendingArtifacts.set(input.objectName, input);
        void this.batcher.add(input.objectName).catch(
            logAndSwallow('warn', { objectName: input.objectName }, 'Failed to enqueue artifact batch item')
        );
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

                await safeExecute(
                    () => this.eventDispatcher.publish(new SceneArtifactBatchReportedEvent({ items: batch })),
                    logAndSwallow('warn', {}, 'Failed to flush scene artifact batch event')
                );
            });

        return this.publishQueue;
    }
}

let daemonArtifactReporterInstance: DaemonArtifactReporter | null = null;

export const getDaemonArtifactReporter = (): DaemonArtifactReporter => {
    daemonArtifactReporterInstance ??= new DaemonArtifactReporter(getEventDispatcher());
    return daemonArtifactReporterInstance;
};
