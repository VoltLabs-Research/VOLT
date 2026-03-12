import type { AnalysisConfig } from '@modules/analysis/domain/entities/Analysis';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface GetAnalysesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
};

export interface AnalysisListTeamCluster {
    _id: string;
    name?: string;
};

export interface AnalysisListTrajectory {
    _id: string;
    name?: string;
};

export interface AnalysisListUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
};

export interface GetAnalysesByTeamIdItemDTO {
    _id: string;
    plugin: string;
    pluginDisplayName?: string;
    teamCluster?: string | AnalysisListTeamCluster;
    config: AnalysisConfig;
    trajectory: string | AnalysisListTrajectory;
    createdBy: string | AnalysisListUser;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<GetAnalysesByTeamIdItemDTO> {};
