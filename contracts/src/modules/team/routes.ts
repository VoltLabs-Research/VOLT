import { get, post, patch, put, del } from '../../shared/routing';
import type {
    CreateTeamInput,
    UpdateTeamInput,
    SetDefaultTeamInput,
    UpdateTeamMemberInput,
    CreateTeamRoleInput,
    UpdateTeamRoleInput,
    SendTeamInvitationInput,
    UpdateTeamInvitationInput,
    TeamInvitationStatusInput,
    CreateSecretKeyInput,
    TeamAIIntegrationMutationInput
} from './http';
import type {
    Team,
    JoinTeamResponse,
    PreviewJoinTeamResponse,
    CheckInvitePermissionResponse,
    GetMyTeamPermissionsResponse,
    SetDefaultTeamResponse,
    DeleteInviteCodeResponse,
    TeamMember,
    TeamRole,
    DeleteTeamRoleResponse,
    TeamInvitation,
    TeamInvitationActionResponse,
    CreateSecretKeyResponse,
    SecretKey,
    RevokeSecretKeyResponse,
    CurrentSecretKeyResponse,
    TeamUsageMetrics,
    KeyUsageMetrics,
    GetTeamAIIntegrationsResponse,
    GetTeamAIIntegrationModelsResponse,
    TeamAIIntegrationMutationResponse
} from './domain';

export const teamRoutes = {
    
    previewJoinByCode: get<PreviewJoinTeamResponse>('/api/teams/invite-codes/:code'),
    joinByCode: post<never, JoinTeamResponse>('/api/teams/invite-codes/:code/memberships'),
    listUserTeams: get<Team>('/api/teams'),
    create: post<CreateTeamInput, Team>('/api/teams'),

    
    getById: get<Team>('/api/teams/:teamId'),
    updateById: patch<UpdateTeamInput, Team>('/api/teams/:teamId'),
    remove: del('/api/teams/:teamId'),
    setDefaultForNewUsers: put<SetDefaultTeamInput, SetDefaultTeamResponse>('/api/teams/:teamId/default-membership'),
    checkInvitePermission: get<CheckInvitePermissionResponse>('/api/teams/:teamId/invite-permission'),
    generateInviteCode: post<never, Team>('/api/teams/:teamId/invite-codes'),
    deleteInviteCode: del<DeleteInviteCodeResponse>('/api/teams/:teamId/invite-codes'),

    
    getMyPermissions: get<GetMyTeamPermissionsResponse>('/api/teams/:teamId/self/permissions'),
    leave: del('/api/teams/:teamId/self/membership')
} as const;

export const teamMemberRoutes = {
    list: get<TeamMember>('/api/teams/:teamId/members'),
    get: get<TeamMember>('/api/teams/:teamId/members/:teamMemberId'),
    update: patch<UpdateTeamMemberInput, TeamMember>('/api/teams/:teamId/members/:teamMemberId'),
    remove: del('/api/teams/:teamId/members/:memberId')
} as const;

export const teamRoleRoutes = {
    list: get<TeamRole>('/api/teams/:teamId/roles'),
    create: post<CreateTeamRoleInput, TeamRole>('/api/teams/:teamId/roles'),
    remove: del<DeleteTeamRoleResponse>('/api/teams/:teamId/roles/:roleId'),
    get: get<TeamRole>('/api/teams/:teamId/roles/:roleId'),
    update: patch<UpdateTeamRoleInput, TeamRole>('/api/teams/:teamId/roles/:roleId')
} as const;

export const teamInvitationRoutes = {
    send: post<SendTeamInvitationInput, TeamInvitation>('/api/teams/:teamId/invitations'),
    list: get<TeamInvitation>('/api/teams/:teamId/invitations'),
    remove: del('/api/teams/:teamId/invitations/:invitationId'),
    update: patch<UpdateTeamInvitationInput, TeamInvitation>('/api/teams/:teamId/invitations/:invitationId'),
    updateStatus: patch<TeamInvitationStatusInput, TeamInvitationActionResponse>('/api/teams/:teamId/invitations/:invitationId/status'),

    
    getByIdPublic: get<TeamInvitation>('/api/teams/invitations/:invitationId'),
    updateStatusPublic: patch<TeamInvitationStatusInput, TeamInvitationActionResponse>('/api/teams/invitations/:invitationId/status')
} as const;

export const secretKeyRoutes = {
    
    current: get<CurrentSecretKeyResponse>('/api/teams/secret-keys/me'),

    
    teamMetrics: get<TeamUsageMetrics>('/api/teams/:teamId/secret-keys/metrics'),
    keyUsage: get<KeyUsageMetrics>('/api/teams/:teamId/secret-keys/:secretKeyId/usage'),
    list: get<SecretKey>('/api/teams/:teamId/secret-keys'),
    create: post<CreateSecretKeyInput, CreateSecretKeyResponse>('/api/teams/:teamId/secret-keys'),
    revokeById: post<never, RevokeSecretKeyResponse>('/api/teams/:teamId/secret-keys/:secretKeyId/revocations'),
    deleteById: del('/api/teams/:teamId/secret-keys/:secretKeyId')
} as const;

export const teamAIIntegrationRoutes = {
    listModels: get<GetTeamAIIntegrationModelsResponse>('/api/teams/:teamId/ai-integrations/models'),
    list: get<GetTeamAIIntegrationsResponse>('/api/teams/:teamId/ai-integrations'),
    createByProvider: post<TeamAIIntegrationMutationInput, TeamAIIntegrationMutationResponse>('/api/teams/:teamId/ai-integrations/:provider'),
    updateByProvider: patch<TeamAIIntegrationMutationInput, TeamAIIntegrationMutationResponse>('/api/teams/:teamId/ai-integrations/:provider'),
    deleteByProvider: del('/api/teams/:teamId/ai-integrations/:provider')
} as const;
