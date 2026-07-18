/**
 * Neutral cross-module contract for the analysis "list/search item" view.
 *
 * MOVED from `@modules/analysis/dtos/GetAnalysesByTeamIdDTO` during
 * the detachable-modules migration so cross-module consumers (dashboard global
 * search) depend on the contracts layer rather than the analysis module. The
 * original owner DTO re-exports every name below, so existing in-module
 * importers compile unchanged.
 *
 * Pure data/types only — `AnalysisConfig` comes from the neutral contracts
 * types; no `@modules/*` imports.
 */
import type { AnalysisConfig } from '@shared/contracts/types/AnalysisProps';

export interface AnalysisListTeamCluster {
    _id: string;
    name?: string;
}

export interface AnalysisListTrajectory {
    _id: string;
    name?: string;
}

export interface AnalysisListUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface GetAnalysesByTeamIdItemDTO {
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
