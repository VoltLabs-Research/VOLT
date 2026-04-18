import { EventGroup, OnEvent } from '@/core/events/decorators';
import { ClusterDaemonTransportEvents } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonTransportEvents';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import { SceneArtifactBatchReportedEvent } from '@/modules/plugin/application/events/SceneArtifactBatchReportedEvent';
import {
    createArtifactUploadJobStatusDedupeKey,
    createArtifactUploadJobStatusMessage,
    createSceneArtifactUpsertBatchMessage
} from '@/modules/plugin/contracts/reverse-channel-plugin';
import { ArtifactUploadCompletedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent';
import { ArtifactUploadFailedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent';
import { ArtifactUploadQueuedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadQueuedEvent';
import { ArtifactUploadStartedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent';

type ArtifactUploadStatus = 'queued' | 'running' | 'completed' | 'failed';

type ArtifactUploadStatusEvent =
    | ArtifactUploadQueuedEvent
    | ArtifactUploadStartedEvent
    | ArtifactUploadCompletedEvent
    | ArtifactUploadFailedEvent;

@EventGroup('plugin')
export class PluginEvents extends ClusterDaemonTransportEvents {
    constructor(voltCloudConnection: ClusterDaemonEventPublisher) {
        super(voltCloudConnection);
    }

    @OnEvent('artifact-upload.queued')
    artifactUploadQueued(event: ArtifactUploadQueuedEvent): void {
        this.emitArtifactUploadStatus(event, 'queued');
    }

    @OnEvent('artifact-upload.started')
    artifactUploadStarted(event: ArtifactUploadStartedEvent): void {
        this.emitArtifactUploadStatus(event, 'running');
    }

    @OnEvent('artifact-upload.completed')
    artifactUploadCompleted(event: ArtifactUploadCompletedEvent): void {
        this.emitArtifactUploadStatus(event, 'completed');
    }

    @OnEvent('artifact-upload.failed')
    artifactUploadFailed(event: ArtifactUploadFailedEvent): void {
        this.emitArtifactUploadStatus(event, 'failed');
    }

    @OnEvent('scene-artifact-batch-reported')
    sceneArtifactBatchReported(event: SceneArtifactBatchReportedEvent): void {
        this.emitBufferedMessage(createSceneArtifactUpsertBatchMessage(this.getMessageContext(), event.payload));
    }

    private emitArtifactUploadStatus(event: ArtifactUploadStatusEvent, status: ArtifactUploadStatus): void {
        this.emitBufferedMessage(
            createArtifactUploadJobStatusMessage(this.getMessageContext(), event.payload, status),
            { dedupeKey: createArtifactUploadJobStatusDedupeKey(event.payload, status) }
        );
    }
}
