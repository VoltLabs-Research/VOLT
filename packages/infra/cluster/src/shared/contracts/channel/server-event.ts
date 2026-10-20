import type {
    AnalysisJobCompletionMessage,
    AnalysisJobStatusMessage,
    AnalysisLogChunkMessage,
    AnalysisProvenanceMessage,
    AnalysisStageStatusMessage,
    DebugLogChunkMessage
} from '@shared/contracts/channel/reverse-channel-analysis';
import type {
    ArtifactUploadJobStatusMessage,
    SceneArtifactUpsertBatchMessage
} from '@shared/contracts/channel/reverse-channel-plugin';
import type {
    GlbJobStatusMessage,
    RasterJobStatusMessage
} from '@shared/contracts/channel/reverse-channel-trajectory';

export type TeamClusterDaemonServerEventMessage =
    | AnalysisJobCompletionMessage
    | AnalysisJobStatusMessage
    | AnalysisStageStatusMessage
    | AnalysisLogChunkMessage
    | AnalysisProvenanceMessage
    | ArtifactUploadJobStatusMessage
    | DebugLogChunkMessage
    | GlbJobStatusMessage
    | RasterJobStatusMessage
    | SceneArtifactUpsertBatchMessage;
