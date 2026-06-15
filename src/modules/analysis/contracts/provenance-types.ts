/** Provenance payload sent from daemon to server via reverse channel. */
export interface AnalysisProvenance {
    pluginName: string;
    pluginVersion: string;
    parameters: Record<string, unknown>;
    inputFrameContentHash: string;
    atomCount: number;
    frameIndex: number;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
    coreToolkitVersion: string;
    rngSeed?: number;
    executedAt: string;
    executedBy: string;
    executionTimeMs: number;
    outputArtifactIds: string[];
}
