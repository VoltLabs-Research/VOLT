import type {
    AnalysisJobCompletionMessage,
    AnalysisJobStatusMessage,
    AnalysisLogChunkMessage,
    AnalysisStageStatusMessage,
    DebugLogChunkMessage
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import type {
    ArtifactUploadJobStatusMessage,
    SceneArtifactUpsertBatchMessage
} from '@/modules/plugin/contracts/reverse-channel-plugin';
import type {
    GlbJobStatusMessage,
    RasterJobStatusMessage
} from '@/modules/trajectory/contracts/reverse-channel-trajectory';

export type TeamClusterDaemonServerEventMessage =
    | AnalysisJobCompletionMessage
    | AnalysisJobStatusMessage
    | AnalysisStageStatusMessage
    | AnalysisLogChunkMessage
    | ArtifactUploadJobStatusMessage
    | DebugLogChunkMessage
    | GlbJobStatusMessage
    | RasterJobStatusMessage
    | SceneArtifactUpsertBatchMessage;
