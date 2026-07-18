// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:*Id`/`:provider` path params) is NOT
// here — the resource service augments those on its own input.

import type { EnabledModel } from './domain';

// ---- Team ------------------------------------------------------------------

export interface CreateTeamInput{
    name: string;
    description: string;
}

/** PATCH /api/teams/:teamId — partial team edit (name/description). */
export interface UpdateTeamInput{
    name?: string;
    description?: string;
}

export interface JoinTeamByCodeInput{
    code: string;
}

export interface SetDefaultTeamInput{
    enabled: boolean;
    teamId?: string;
}

// ---- Team members ----------------------------------------------------------

/** PATCH /api/teams/:teamId/members/:teamMemberId — reassign role. */
export interface UpdateTeamMemberInput{
    role?: string;
}

// ---- Team roles ------------------------------------------------------------

export interface CreateTeamRoleInput{
    name: string;
    permissions?: string[];
    isSystem?: boolean;
}

export interface UpdateTeamRoleInput{
    name?: string;
    permissions?: string[];
}

// ---- Team invitations ------------------------------------------------------

export interface SendTeamInvitationInput{
    email: string;
    roleId?: string;
}

/** PATCH .../invitations/:invitationId — partial invitation edit. */
export interface UpdateTeamInvitationInput{
    status?: string;
    role?: string;
    email?: string;
}

/** PATCH .../invitations/:invitationId/status — accept/reject dispatch. */
export interface TeamInvitationStatusInput{
    status: 'accepted' | 'rejected';
}

// ---- Secret keys -----------------------------------------------------------

export interface CreateSecretKeyInput{
    roleId: string;
    name: string;
}

// ---- AI integrations -------------------------------------------------------

export interface TeamAIIntegrationMutationInput{
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
}
