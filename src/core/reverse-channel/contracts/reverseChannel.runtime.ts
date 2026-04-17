import type { TeamClusterDaemonQueueScopeLimits, TeamClusterDaemonRoleApplyPayload, TeamClusterDaemonRoleApplyResult, TeamClusterEffectiveCapabilities, TeamClusterRuntimeRoleConfig } from '@/core/runtime/contracts/teamClusterRuntime';

export interface TeamClusterDaemonQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterDaemonQueueConcurrencyApplyPayload {
    [key: string]: unknown;
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
};

export interface TeamClusterDaemonRuntimeConfig {
    contractVersion: number;
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
}

export type TeamClusterDaemonPluginMongoDocumentType = 'listing' | 'sub-listing';

export interface TeamClusterDaemonPluginMongoExportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    skip?: number;
    limit?: number;
}

export interface TeamClusterDaemonPluginMongoImportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    rows: Record<string, unknown>[];
}

export interface TeamClusterDaemonPluginMongoPurgePayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
}

export type {
    TeamClusterDaemonRoleApplyPayload,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterEffectiveCapabilities,
    TeamClusterRuntimeRoleConfig
};
