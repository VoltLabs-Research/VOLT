import type {
    DaemonAnalysisJobStatusInput,
    DaemonAnalysisStageStatusInput,
    DaemonArtifactUploadJobStatusInput,
    DaemonGlbJobStatusInput,
    DaemonJobCompletionInput,
    DaemonRasterJobStatusInput
} from '@shared/contracts/ports/IDaemonAnalysisCompletionService';

type DaemonJobReport<TType extends string, TInput> = TInput & {
    type: TType;
    teamClusterId: string;
    daemonPassword: string;
};

export type ProcessDaemonAnalysisJobCompletionInput = DaemonJobReport<'analysis-job-completion', DaemonJobCompletionInput>;
export type ProcessDaemonAnalysisJobStatusInput = DaemonJobReport<'analysis-job-status', DaemonAnalysisJobStatusInput>;
export type ProcessDaemonAnalysisStageStatusInput = DaemonJobReport<'analysis-stage-status', DaemonAnalysisStageStatusInput>;
export type ProcessDaemonRasterJobStatusInput = DaemonJobReport<'trajectory-raster-job-status', DaemonRasterJobStatusInput>;
export type ProcessDaemonGlbJobStatusInput = DaemonJobReport<'trajectory-glb-job-status', DaemonGlbJobStatusInput>;
export type ProcessDaemonArtifactUploadJobStatusInput = DaemonJobReport<'artifact-upload-job-status', DaemonArtifactUploadJobStatusInput>;

export type ProcessDaemonJobCompletionInput =
    | ProcessDaemonAnalysisJobCompletionInput
    | ProcessDaemonAnalysisJobStatusInput
    | ProcessDaemonAnalysisStageStatusInput
    | ProcessDaemonRasterJobStatusInput
    | ProcessDaemonGlbJobStatusInput
    | ProcessDaemonArtifactUploadJobStatusInput;

export interface ProcessDaemonJobCompletionOutput {
    acknowledged: boolean;
}
