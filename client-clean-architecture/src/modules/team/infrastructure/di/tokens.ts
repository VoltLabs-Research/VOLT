export const TEAM_TOKENS = {
    TeamRepository: Symbol('TeamRepository'),
    TeamRoleRepository: Symbol('TeamRoleRepository'),
    TeamMemberRepository: Symbol('TeamMemberRepository'),
    TeamInvitationRepository: Symbol('TeamInvitationRepository'),

    TeamStorage: Symbol('TeamStorage'),

    CreateTeamUseCase: Symbol('CreateTeamUseCase')
} as const;
