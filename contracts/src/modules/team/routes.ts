import { get, post, patch, put, del } from '../../shared/routing';
import type {
    CreateTeamInput,
    UpdateTeamInput,
    JoinTeamByCodeInput,
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
    PersistedTeam,
    JoinTeamResponse,
    PreviewJoinTeamResponse,
    CheckInvitePermissionResponse,
    GetMyTeamPermissionsResponse,
    SetDefaultTeamResponse,
    DeleteInviteCodeResponse,
    PersistedTeamMember,
    PersistedTeamRole,
    DeleteTeamRoleResponse,
    PersistedTeamInvitation,
    TeamInvitationActionResponse,
    CreateSecretKeyResponse,
    SecretKeyListItem,
    RevokeSecretKeyResponse,
    CurrentSecretKeyResponse,
    SecretKeyTeamMetricsResponse,
    SecretKeyUsageResponse,
    GetTeamAIIntegrationsResponse,
    GetTeamAIIntegrationModelsResponse,
    TeamAIIntegrationMutationResponse
} from './domain';

/**
 * Every client-facing team endpoint, typed by request/response. Paths are the
 * full wire paths, reproducing the previous `createHttpModule` base paths
 * verbatim across the six team resources:
 *  - team           → /api/teams (+ /api/teams/:teamId/self)
 *  - team-member    → /api/teams/:teamId/members
 *  - team-role      → /api/teams/:teamId/roles
 *  - team-invitation→ /api/teams/:teamId/invitations (+ public /api/teams/invitations)
 *  - secret-key     → /api/teams/:teamId/secret-keys (+ self /api/teams/secret-keys)
 *  - ai-integration → /api/teams/:teamId/ai-integrations
 *
 * Order matters for the controllers: literal segments (`/join`, `/metrics`,
 * `/models`, `/me`) are declared before the `/:id` param routes so Express
 * matches them first, matching the previous route-file ordering.
 */

// ---- Team ------------------------------------------------------------------

export const teamRoutes = {
    // /api/teams — protect only (no team scope) for join/list/create
    previewJoinByCode: post<JoinTeamByCodeInput, PreviewJoinTeamResponse>('/api/teams/join/preview'),
    joinByCode: post<JoinTeamByCodeInput, JoinTeamResponse>('/api/teams/join'),
    listUserTeams: get<PersistedTeam>('/api/teams'),
    create: post<CreateTeamInput, PersistedTeam>('/api/teams'),

    // /api/teams/:teamId — protect + teamScoped(TEAM)
    getById: get<PersistedTeam>('/api/teams/:teamId'),
    updateById: patch<UpdateTeamInput, PersistedTeam>('/api/teams/:teamId'),
    remove: del('/api/teams/:teamId'),
    setDefaultForNewUsers: put<SetDefaultTeamInput, SetDefaultTeamResponse>('/api/teams/:teamId/default-membership'),
    checkInvitePermission: get<CheckInvitePermissionResponse>('/api/teams/:teamId/invite-permission'),
    generateInviteCode: post<never, PersistedTeam>('/api/teams/:teamId/invite-code'),
    deleteInviteCode: del<DeleteInviteCodeResponse>('/api/teams/:teamId/invite-code'),

    // /api/teams/:teamId/self — protect + membership only (no RBAC resource)
    getMyPermissions: get<GetMyTeamPermissionsResponse>('/api/teams/:teamId/self/permissions'),
    leave: del('/api/teams/:teamId/self/membership')
} as const;

// ---- Team members ----------------------------------------------------------

export const teamMemberRoutes = {
    list: get<PersistedTeamMember>('/api/teams/:teamId/members'),
    get: get<PersistedTeamMember>('/api/teams/:teamId/members/:teamMemberId'),
    update: patch<UpdateTeamMemberInput, PersistedTeamMember>('/api/teams/:teamId/members/:teamMemberId'),
    remove: del('/api/teams/:teamId/members/:memberId')
} as const;

// ---- Team roles ------------------------------------------------------------

export const teamRoleRoutes = {
    list: get<PersistedTeamRole>('/api/teams/:teamId/roles'),
    create: post<CreateTeamRoleInput, PersistedTeamRole>('/api/teams/:teamId/roles'),
    remove: del<DeleteTeamRoleResponse>('/api/teams/:teamId/roles/:roleId'),
    get: get<PersistedTeamRole>('/api/teams/:teamId/roles/:roleId'),
    update: patch<UpdateTeamRoleInput, PersistedTeamRole>('/api/teams/:teamId/roles/:roleId')
} as const;

// ---- Team invitations ------------------------------------------------------

export const teamInvitationRoutes = {
    send: post<SendTeamInvitationInput, PersistedTeamInvitation>('/api/teams/:teamId/invitations'),
    list: get<PersistedTeamInvitation>('/api/teams/:teamId/invitations'),
    remove: del('/api/teams/:teamId/invitations/:invitationId'),
    update: patch<UpdateTeamInvitationInput, PersistedTeamInvitation>('/api/teams/:teamId/invitations/:invitationId'),
    updateStatus: patch<TeamInvitationStatusInput, TeamInvitationActionResponse>('/api/teams/:teamId/invitations/:invitationId/status'),

    // public — protect only (no team scope)
    getByIdPublic: get<PersistedTeamInvitation>('/api/teams/invitations/:invitationId'),
    updateStatusPublic: patch<TeamInvitationStatusInput, TeamInvitationActionResponse>('/api/teams/invitations/:invitationId/status')
} as const;

// ---- Secret keys -----------------------------------------------------------

export const secretKeyRoutes = {
    // self — protect only (no team scope)
    current: get<CurrentSecretKeyResponse>('/api/teams/secret-keys/me'),

    // /api/teams/:teamId/secret-keys — protect + teamScoped(TEAM_SECRET_KEY)
    teamMetrics: get<SecretKeyTeamMetricsResponse>('/api/teams/:teamId/secret-keys/metrics'),
    keyUsage: get<SecretKeyUsageResponse>('/api/teams/:teamId/secret-keys/:secretKeyId/usage'),
    list: get<SecretKeyListItem>('/api/teams/:teamId/secret-keys'),
    create: post<CreateSecretKeyInput, CreateSecretKeyResponse>('/api/teams/:teamId/secret-keys'),
    revokeById: patch<never, RevokeSecretKeyResponse>('/api/teams/:teamId/secret-keys/:secretKeyId'),
    deleteById: del('/api/teams/:teamId/secret-keys/:secretKeyId')
} as const;

// ---- AI integrations -------------------------------------------------------

export const teamAIIntegrationRoutes = {
    listModels: get<GetTeamAIIntegrationModelsResponse>('/api/teams/:teamId/ai-integrations/models'),
    list: get<GetTeamAIIntegrationsResponse>('/api/teams/:teamId/ai-integrations'),
    createByProvider: post<TeamAIIntegrationMutationInput, TeamAIIntegrationMutationResponse>('/api/teams/:teamId/ai-integrations/:provider'),
    updateByProvider: patch<TeamAIIntegrationMutationInput, TeamAIIntegrationMutationResponse>('/api/teams/:teamId/ai-integrations/:provider'),
    deleteByProvider: del('/api/teams/:teamId/ai-integrations/:provider')
} as const;
