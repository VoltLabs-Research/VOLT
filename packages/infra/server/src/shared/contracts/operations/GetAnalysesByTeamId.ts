
import type { AnalysisConfig } from '@shared/contracts/types/AnalysisProps';

interface AnalysisListTeamCluster {
    _id: string;
    name?: string;
}

interface AnalysisListTrajectory {
    _id: string;
    name?: string;
}

interface AnalysisListUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface GetAnalysesByTeamIdItemView {
    _id: string;
    plugin: string;
    pluginDisplayName: string;
    computeClusterId?: string | AnalysisListTeamCluster;
    storageClusterId?: string | AnalysisListTeamCluster;
    config: AnalysisConfig;
    trajectory: string | AnalysisListTrajectory;
    createdBy: string | AnalysisListUser;
    totalFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
}
