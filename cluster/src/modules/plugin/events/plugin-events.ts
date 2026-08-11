import { createDomainEvent } from '@shared/domain/events/create-domain-event';
import type { SceneArtifactUpsertBatch } from '@shared/contracts/channel/reverse-channel-plugin';
import type { Failed, JobIdentity } from '@shared/contracts/types/job-identity';

export type BaseArtifactUploadEventData = JobIdentity;
export type ArtifactUploadFailedEventData = Failed<BaseArtifactUploadEventData>;

export const ArtifactUploadStartedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.started');
export const ArtifactUploadCompletedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.completed');
export const ArtifactUploadFailedEvent = createDomainEvent<ArtifactUploadFailedEventData>('plugin.artifact-upload.failed');
export const SceneArtifactBatchReportedEvent = createDomainEvent<SceneArtifactUpsertBatch>('plugin.scene-artifact-batch-reported');
