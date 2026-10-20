

import type { EnabledModel } from './domain';

export interface CreateTeamInput{
    name: string;
    description: string;
}

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

export interface UpdateTeamMemberInput{
    role?: string;
}

export interface CreateTeamRoleInput{
    name: string;
    permissions?: string[];
    isSystem?: boolean;
}

export interface UpdateTeamRoleInput{
    name?: string;
    permissions?: string[];
}

export interface SendTeamInvitationInput{
    email: string;
    roleId?: string;
}

export interface UpdateTeamInvitationInput{
    status?: string;
    role?: string;
    email?: string;
}

export interface TeamInvitationStatusInput{
    status: 'accepted' | 'rejected';
}

export interface CreateSecretKeyInput{
    roleId: string;
    name: string;
}

export interface TeamAIIntegrationMutationInput{
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
}
