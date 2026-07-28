import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { AIProvider } from '../ai/domain';

export interface Team extends BaseEntity{
    name: string;
    description?: string;
    owner: User;
    inviteCode?: string;
}

export interface TeamRole extends BaseEntity{
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
}

export interface TeamMember extends BaseEntity{
    team: Ref<Team>;
    user: User;
    role: TeamRole;
    joinedAt: string;
}

export interface TeamMemberStats extends TeamMember{
    trajectoriesCount: number;
    analysesCount: number;
    latexCount: number;
    whiteboardsCount: number;
}

export enum TeamInvitationStatus{
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
}

export interface TeamInvitation extends BaseEntity{
    team: Team;
    invitedBy: User;
    invitedUser: User;
    email: string;
    token: string;
    role: string;
    expiresAt: string;
    acceptedAt?: string;
    status: TeamInvitationStatus;
}

export interface JoinTeamResponse{
    message: string;
    teamId: string;
}

export interface PreviewJoinTeamResponse{
    message: string;
    teamId: string;
    teamName: string;
    ownerName: string;
    isAlreadyMember: boolean;
}

export interface CheckInvitePermissionResponse{
    canInvite: boolean;
}

export interface GetMyTeamPermissionsResponse{
    permissions: string[];
}

export interface SetDefaultTeamResponse{
    defaultTeam: string | null;
    autoJoinNewMembers: boolean;
}

export interface DeleteInviteCodeResponse{
    message: string;
}

export interface DeleteTeamRoleResponse{
    success: boolean;
}

export interface TeamInvitationActionResponse{
    message: string;
}

export interface SecretKey extends BaseEntity{
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    createdBy?: Ref<User>;
    isActive: boolean;
    lastUsedAt?: string;
}

export interface CreateSecretKeyResponse{
    secretKeyId: string;
    teamId: string;
    roleId: string;
    name: string;
    keyPrefix: string;
    secretKey: string;
    isActive: boolean;
    createdAt: string;
}

export interface RevokeSecretKeyResponse{
    _id: string;
    teamId: string;
    isActive: boolean;
    updatedAt: string;
}

export interface CurrentSecretKeyResponse{
    _id: string;
    team: string;
    role: string;
    createdBy: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SecretKeyEndpointStat{
    method: string;
    path: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
}

export interface SecretKeyStatusCodeStat{
    code: number;
    count: number;
}

export interface SecretKeyPerKeyMetric{
    secretKeyId: string;
    name: string;
    keyPrefix: string;
    roleName: string;
    isActive: boolean;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: string | null;
}

export interface SecretKeyTeamUsageOverview{
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
}

export interface SecretKeyTeamDailySeries{
    labels: string[];
    total: number[];
    byKey: Record<string, number[]>;
}

export interface TeamUsageMetrics{
    overview: SecretKeyTeamUsageOverview;
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    perKey: SecretKeyPerKeyMetric[];
    daily: SecretKeyTeamDailySeries;
    topEndpoints: SecretKeyEndpointStat[];
}

export interface KeyUsageMetricsKeySummary{
    _id: string;
    name: string;
    keyPrefix: string;
    roleName: string;
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
}

export interface KeyUsageMetricsStats{
    totalRequests: number;
    requests24h: number;
    requests7d: number;
    successRate: number;
    avgResponseTime: number;
    peakHour: string;
}

export interface KeyUsageMetricsSeries{
    labels: string[];
    data: number[];
}

export interface KeyUsageMetricsRequest{
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    createdAt: string;
}

export interface KeyUsageMetrics{
    key: KeyUsageMetricsKeySummary;
    stats: KeyUsageMetricsStats;
    hourly: KeyUsageMetricsSeries;
    daily: KeyUsageMetricsSeries;
    endpoints: SecretKeyEndpointStat[];
    statusDistribution: SecretKeyStatusCodeStat[];
    recentRequests: KeyUsageMetricsRequest[];
}

export interface TeamAIModelMetadata{
    id: string;
    name: string;
}

export type EnabledModel = TeamAIModelMetadata;

export interface TeamAIIntegration extends BaseEntity{
    teamId: string;
    provider: AIProvider;
    providerName: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: TeamAIModelMetadata[];
    metadata?: Record<string, unknown>;
    hasApiKey: boolean;
    createdBy?: string;
}

export interface TeamAIProviderCatalogItem{
    id: string;
    name: string;
    description: string;
}

export interface TeamAIProviderModels{
    provider: AIProvider;
    providerName: string;
    defaultModel?: string;
    metadata?: Record<string, unknown>;
    models: TeamAIModelMetadata[];
}

export interface TeamAIModelListItem extends TeamAIModelMetadata{
    provider: AIProvider;
    providerName: string;
    isDefault: boolean;
}

export interface GetTeamAIIntegrationsResponse{
    teamId: string;
    integrations: TeamAIIntegration[];
    providers: TeamAIProviderCatalogItem[];
}

export interface GetTeamAIIntegrationModelsResponse{
    teamId: string;
    providers: TeamAIProviderModels[];
    models: TeamAIModelListItem[];
}

export interface TeamAIIntegrationMutationResponse{
    integration: TeamAIIntegration;
}
