

import type { EnabledModel } from './domain';
import type { TeamRole } from './access';

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
    role: TeamRole;
}

export interface SendTeamInvitationInput{
    email: string;
    role?: TeamRole;
}

export interface UpdateTeamInvitationInput{
    status?: string;
    role?: TeamRole;
    email?: string;
}

export interface TeamInvitationStatusInput{
    status: 'accepted' | 'rejected';
}

export interface CreateSecretKeyInput{
    role: TeamRole;
    name: string;
}

export interface TeamAIIntegrationMutationInput{
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
}
