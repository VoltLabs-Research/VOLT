import type {
    AnalysisJobCompletionMessage,
    AnalysisJobStatusMessage,
    AnalysisLogChunkMessage,
    DebugLogChunkMessage
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import type {
    ArtifactUploadJobStatusMessage,
    SceneArtifactUpsertBatchMessage
} from '@/modules/plugin/contracts/reverse-channel-plugin';
import type {
    GlbJobStatusMessage,
    RasterJobStatusMessage,
    SshImportJobStatusMessage
} from '@/modules/trajectory/contracts/reverse-channel-trajectory';

export type TeamClusterDaemonServerEventMessage =
    | AnalysisJobCompletionMessage
    | AnalysisJobStatusMessage
    | AnalysisLogChunkMessage
    | ArtifactUploadJobStatusMessage
    | DebugLogChunkMessage
    | GlbJobStatusMessage
    | RasterJobStatusMessage
    | SceneArtifactUpsertBatchMessage
    | SshImportJobStatusMessage;
