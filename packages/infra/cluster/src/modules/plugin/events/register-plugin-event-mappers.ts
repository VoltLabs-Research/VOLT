import type { DomainEventBridge, EventMapperSet } from '@shared/events/DomainEventBridge';
import { registerStatusTriple } from '@shared/events/register-status-triple';
import {
    createArtifactUploadJobStatusDedupeKey,
    createArtifactUploadJobStatusMessage,
    createSceneArtifactUpsertBatchMessage
} from '@shared/contracts/channel/reverse-channel-plugin';
import {
    ArtifactUploadCompletedEvent,
    ArtifactUploadFailedEvent,
    ArtifactUploadStartedEvent,
    SceneArtifactBatchReportedEvent
} from '@modules/plugin/events/plugin-events';

type ArtifactUploadStatus = 'running' | 'completed' | 'failed';

export const registerPluginEventMappers: EventMapperSet = (bridge: DomainEventBridge): void => {
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
