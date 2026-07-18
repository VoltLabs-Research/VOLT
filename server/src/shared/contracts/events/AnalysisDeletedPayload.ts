
export interface AnalysisDeletedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    teamId: string;
    teamClusterId?: string;
    storageClusterId?: string;
    computeClusterId?: string;
    userId: string;
    pluginDisplayName: string;
}
