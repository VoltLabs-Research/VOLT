import type { AnalysisJobCompletionMessage } from '@/core/reverse-channel/contracts/messages/analysis-job-completion';
import type { AnalysisJobStatusMessage } from '@/core/reverse-channel/contracts/messages/analysis-job-status';
import type { AnalysisLogChunkMessage } from '@/core/reverse-channel/contracts/messages/analysis-log-chunk';
import type { ArtifactUploadJobStatusMessage } from '@/core/reverse-channel/contracts/messages/artifact-upload-job-status';
import type { DebugLogChunkMessage } from '@/core/reverse-channel/contracts/messages/debug-log-chunk';
import type { GlbJobStatusMessage } from '@/core/reverse-channel/contracts/messages/glb-job-status';
import type { RasterJobStatusMessage } from '@/core/reverse-channel/contracts/messages/raster-job-status';
import type { SceneArtifactUpsertBatchMessage } from '@/core/reverse-channel/contracts/messages/scene-artifact-upsert-batch';
import type { SshImportJobStatusMessage } from '@/core/reverse-channel/contracts/messages/ssh-import-job-status';

interface AnalysisJobCompletionServerEventMessage extends AnalysisJobCompletionMessage {}

interface AnalysisJobStatusServerEventMessage extends AnalysisJobStatusMessage {}

interface AnalysisLogChunkServerEventMessage extends AnalysisLogChunkMessage {}

interface ArtifactUploadJobStatusServerEventMessage extends ArtifactUploadJobStatusMessage {}

interface DebugLogChunkServerEventMessage extends DebugLogChunkMessage {}

interface GlbJobStatusServerEventMessage extends GlbJobStatusMessage {}

interface RasterJobStatusServerEventMessage extends RasterJobStatusMessage {}

interface SceneArtifactUpsertBatchServerEventMessage extends SceneArtifactUpsertBatchMessage {}

interface SshImportJobStatusServerEventMessage extends SshImportJobStatusMessage {}

export type TeamClusterDaemonServerEventMessage =
    | AnalysisJobCompletionServerEventMessage
    | AnalysisJobStatusServerEventMessage
    | AnalysisLogChunkServerEventMessage
    | ArtifactUploadJobStatusServerEventMessage
    | DebugLogChunkServerEventMessage
    | GlbJobStatusServerEventMessage
    | RasterJobStatusServerEventMessage
    | SceneArtifactUpsertBatchServerEventMessage
    | SshImportJobStatusServerEventMessage;
