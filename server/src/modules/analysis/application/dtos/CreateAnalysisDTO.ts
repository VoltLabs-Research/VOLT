import type { AnalysisConfig } from '@modules/analysis/domain/entities/Analysis';

interface CreateAnalysisOutputAnalysisDTO {
    _id: string;
    trajectory: string;
    plugin: string;
    pluginDisplayName: string;
    teamCluster?: string;
    config: AnalysisConfig;
    status: string;
    createdAt: Date;
};

export interface CreateAnalysisInputDTO {
    trajectoryId: string;
    pluginId: string;
    config: AnalysisConfig;
    userId: string;
    teamId: string;
    teamClusterId?: string;
};

export interface CreateAnalysisOutputDTO {
    analysis: CreateAnalysisOutputAnalysisDTO;
};
