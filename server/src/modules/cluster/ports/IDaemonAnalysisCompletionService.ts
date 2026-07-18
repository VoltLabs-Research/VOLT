/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/cluster/ports/IDaemonAnalysisCompletionService` importers keep
 * working unchanged.
 */
export type {
    IDaemonAnalysisCompletionService,
    DaemonJobCompletionInput,
    DaemonAnalysisJobStatusInput,
    DaemonAnalysisStageStatusInput,
    DaemonRasterJobStatusInput,
    DaemonGlbJobStatusInput,
    DaemonArtifactUploadJobStatusInput,
    QueuedJobNotification,
    QueuedDaemonJobNotification
} from '@shared/contracts/ports/IDaemonAnalysisCompletionService';
