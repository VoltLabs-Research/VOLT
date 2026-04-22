import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { SceneArtifactUpsertBatch } from '@/modules/plugin/contracts/reverse-channel-plugin';
import type { Failed, JobIdentity } from '@/support/contracts/job-identity';

export type BaseArtifactUploadEventData = JobIdentity;
export type ArtifactUploadFailedEventData = Failed<BaseArtifactUploadEventData>;

export const ArtifactUploadStartedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.started');
export const ArtifactUploadCompletedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.completed');
export const ArtifactUploadFailedEvent = createDomainEvent<ArtifactUploadFailedEventData>('plugin.artifact-upload.failed');
export const SceneArtifactBatchReportedEvent = createDomainEvent<SceneArtifactUpsertBatch>('plugin.scene-artifact-batch-reported');
