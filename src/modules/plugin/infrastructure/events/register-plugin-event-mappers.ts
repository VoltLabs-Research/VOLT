import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { registerStatusTriple } from '@/core/reverse-channel/infrastructure/events/register-status-triple';
import {
    createArtifactUploadJobStatusDedupeKey,
    createArtifactUploadJobStatusMessage,
    createSceneArtifactUpsertBatchMessage
} from '@/modules/plugin/contracts/reverse-channel-plugin';
import {
    ArtifactUploadCompletedEvent,
    ArtifactUploadFailedEvent,
    ArtifactUploadStartedEvent,
    SceneArtifactBatchReportedEvent
} from '@/modules/plugin/domain/events';

type ArtifactUploadStatus = 'running' | 'completed' | 'failed';

export const registerPluginEventMappers = (bridge: DomainEventBridge): void => {
    registerStatusTriple<Parameters<typeof createArtifactUploadJobStatusMessage>[1], ArtifactUploadStatus>({
        bridge,
        events: {
            running: ArtifactUploadStartedEvent,
            completed: ArtifactUploadCompletedEvent,
            failed: ArtifactUploadFailedEvent
        },
        buildMessage: (ctx, payload, status) => createArtifactUploadJobStatusMessage(ctx, payload, status),
        buildDedupeKey: (payload, status) => createArtifactUploadJobStatusDedupeKey(payload, status)
    });

    bridge.register(SceneArtifactBatchReportedEvent, (payload, { messageContext }) => ({
        kind: 'buffered',
        message: createSceneArtifactUpsertBatchMessage(messageContext, payload)
    }));
};
