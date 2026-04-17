import Bottleneck from 'bottleneck';

import type { IEventBus } from '@/core/events/IEventBus';
import { logger } from '@/core/logger';
import { SceneArtifactBatchReportedEvent } from '@/modules/plugin/application/events/SceneArtifactBatchReportedEvent';

export interface ReportArtifactInput {
    analysis?: string;
    displayName: string;
    metadata?: object;
    objectName: string;
    params: object;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    status: 'ready' | 'failed';
    storageBucket: string;
    storageClusterId: string;
    timestep: number;
    trajectory: string;
}

export interface DaemonArtifactReporterService {
    flushPendingArtifacts(): Promise<void>;
    reportArtifact(input: ReportArtifactInput): Promise<void>;
}

interface DaemonArtifactReporterState {
    batcher: Bottleneck.Batcher;
    pendingArtifacts: Map<string, ReportArtifactInput>;
    publishQueue: Promise<void>;
}

const SCENE_ARTIFACT_BATCH_SIZE = 64;
const SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS = 250;

const publishBatch = async (eventBus: IEventBus, batch: ReportArtifactInput[]): Promise<void> => {
    if (batch.length === 0) {
        return;
    }

    await eventBus.publish(new SceneArtifactBatchReportedEvent({
        items: batch
    }));
};

const enqueuePublish = (
    state: DaemonArtifactReporterState,
    eventBus: IEventBus,
    batch: ReportArtifactInput[]
): Promise<void> => {
    state.publishQueue = state.publishQueue
        .catch(() => undefined)
        .then(async () => {
            try {
                await publishBatch(eventBus, batch);
            } catch (error) {
                logger.warn({ err: error }, 'Failed to flush scene artifact batch event');
            }
        });

    return state.publishQueue;
};

const flushPendingArtifacts = async (state: DaemonArtifactReporterState, eventBus: IEventBus): Promise<void> => {
    const batch = Array.from(state.pendingArtifacts.values());
    if (batch.length > 0) {
        state.pendingArtifacts.clear();
        await enqueuePublish(state, eventBus, batch);
    }

    await state.publishQueue;
};

export const createDaemonArtifactReporterService = (eventBus: IEventBus): DaemonArtifactReporterService => {
    const state: DaemonArtifactReporterState = {
        batcher: new Bottleneck.Batcher({
            maxSize: SCENE_ARTIFACT_BATCH_SIZE,
            maxTime: SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS
        }),
        pendingArtifacts: new Map<string, ReportArtifactInput>(),
        publishQueue: Promise.resolve()
    };

    state.batcher.on('batch', (keys: string[]) => {
        const uniqueKeys = [...new Set(keys)];
        const batch: ReportArtifactInput[] = [];

        for (const key of uniqueKeys) {
            const artifact = state.pendingArtifacts.get(key);
            if (!artifact) {
                continue;
            }

            batch.push(artifact);
            state.pendingArtifacts.delete(key);
        }

        void enqueuePublish(state, eventBus, batch);
    });
    state.batcher.on('error', (error) => {
        logger.warn({ err: error }, 'Artifact batcher error');
    });

    return {
        reportArtifact: async (input) => {
            state.pendingArtifacts.set(input.objectName, input);
            void state.batcher.add(input.objectName).catch((error) => {
                logger.warn({ err: error }, 'Failed to enqueue artifact batch item');
            });
        },
        flushPendingArtifacts: () => flushPendingArtifacts(state, eventBus)
    };
};
