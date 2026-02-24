export const TEAM_TOKENS = {
    TeamRepository: Symbol('TeamRepository'),
    TeamRoleRepository: Symbol('TeamRoleRepository'),
    TeamMemberRepository: Symbol('TeamMemberRepository'),
    TeamInvitationRepository: Symbol('TeamInvitationRepository'),
    SecretKeyRepository: Symbol('SecretKeyRepository'),

    TeamStorage: Symbol('TeamStorage'),

    CreateTeamUseCase: Symbol('CreateTeamUseCase')
} as const;
