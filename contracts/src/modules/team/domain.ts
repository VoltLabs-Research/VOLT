

export interface PersistedTeam{
    _id: string;
    name: string;
    description: string;
    owner: unknown;
    inviteCode?: string;
    createdAt: string;
    updatedAt: string;
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

export interface PersistedTeamMember{
    _id: string;
    team: unknown;
    user: unknown;
    role: unknown;
    joinedAt: string;
    createdAt: string;
    updatedAt: string;
    trajectoriesCount?: number;
    analysesCount?: number;
    latexCount?: number;
    whiteboardsCount?: number;
}

export interface PersistedTeamRole{
    _id: string;
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface DeleteTeamRoleResponse{
    success: boolean;
}

export interface PersistedTeamInvitation{
    _id: string;
    team: unknown;
    invitedBy: unknown;
    invitedUser: unknown;
    email: string;
    token: string;
    role: unknown;
    expiresAt: string;
    acceptedAt?: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TeamInvitationActionResponse{
    message: string;
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

export interface SecretKeyListItem{
    _id: string;
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    createdBy: unknown;
    isActive: boolean;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
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

export type SecretKeyTeamMetricsResponse = Record<string, unknown>;

export type SecretKeyUsageResponse = Record<string, unknown>;

export interface EnabledModel{
    id: string;
    name: string;
}

export interface TeamAIIntegrationItem{
    _id: string;
    teamId: string;
    provider: string;
    providerName: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
    hasApiKey: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TeamAIProviderCatalogItem{
    id: string;
    name: string;
    description: string;
}

export interface GetTeamAIIntegrationsResponse{
    teamId: string;
    integrations: TeamAIIntegrationItem[];
    providers: TeamAIProviderCatalogItem[];
}

export interface TeamAIModelMetadata{
    id: string;
    name: string;
}

export interface TeamAIProviderModels{
    provider: string;
    providerName: string;
    defaultModel?: string;
    metadata?: Record<string, unknown>;
    models: TeamAIModelMetadata[];
}

export interface TeamAIModelListItem extends TeamAIModelMetadata{
    provider: string;
    providerName: string;
    isDefault: boolean;
}

export interface GetTeamAIIntegrationModelsResponse{
    teamId: string;
    providers: TeamAIProviderModels[];
    models: TeamAIModelListItem[];
}

export interface TeamAIIntegrationMutationResponse{
    integration: TeamAIIntegrationItem;
}
