import type { Analysis } from '@volt/contracts/modules/analysis/domain';

export const SOCKET_ANALYSIS_EVENTS = {
    CREATED: 'analysis.created',
    DELETED: 'analysis.deleted',
    STATUS_CHANGED: 'analysis.status.changed',
    STAGE_CHANGED: 'analysis.stage.changed',
    LOG_SUBSCRIBE: 'subscribe_to_analysis_log',
    LOG_UNSUBSCRIBE: 'unsubscribe_from_analysis_log',
    LOG_CHUNK: 'analysis-log:chunk'
} as const;

export interface AnalysisCreatedSocketPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName: string;
    config: Analysis['config'];
    status: Analysis['status'];
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    createdAt: string;
}

export interface AnalysisStatusChangedSocketPayload {
    analysisId: string;
    trajectoryId: string;
    status: Analysis['status'];
    totalFrames?: number;
    failedFrames?: number;
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    stages?: Analysis['stages'];
    childAnalyses?: Analysis['childAnalyses'];
}

export type AnalysisStageChangedSocketPayload = Omit<
    AnalysisStatusChangedSocketPayload,
    'status' | 'totalFrames' | 'failedFrames'
>;

export interface AnalysisDeletedSocketPayload {
    analysisId: string;
    trajectoryId: string;
}
