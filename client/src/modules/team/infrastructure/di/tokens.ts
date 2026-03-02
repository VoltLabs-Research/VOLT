export const TEAM_TOKENS = {
    TeamRepository: Symbol('TeamRepository'),
    TeamRoleRepository: Symbol('TeamRoleRepository'),
    TeamMemberRepository: Symbol('TeamMemberRepository'),
    TeamInvitationRepository: Symbol('TeamInvitationRepository'),
    SecretKeyRepository: Symbol('SecretKeyRepository'),
    TeamAIIntegrationRepository: Symbol('TeamAIIntegrationRepository'),

    TeamStorage: Symbol('TeamStorage'),

    CreateTeamUseCase: Symbol('CreateTeamUseCase')
} as const;
