export const TEAM_TOKENS = {
    TeamRepository: Symbol('TeamRepository'),
    TeamRoleRepository: Symbol('TeamRoleRepository'),
    TeamMemberRepository: Symbol('TeamMemberRepository'),
    TeamInvitationRepository: Symbol('TeamInvitationRepository'),

    TeamStorage: Symbol('TeamStorage'),

    CreateTeamUseCase: Symbol('CreateTeamUseCase'),
    UpdateTeamUseCase: Symbol('UpdateTeamUseCase'),
    DeleteTeamUseCase: Symbol('DeleteTeamUseCase'),
    GetAllTeamsUseCase: Symbol('GetAllTeamsUseCase'),
    LeaveTeamUseCase: Symbol('LeaveTeamUseCase'),
    CanInviteUseCase: Symbol('CanInviteUseCase'),

    CreateTeamRoleUseCase: Symbol('CreateTeamRoleUseCase'),
    UpdateTeamRoleUseCase: Symbol('UpdateTeamRoleUseCase'),
    DeleteTeamRoleUseCase: Symbol('DeleteTeamRoleUseCase'),
    GetAllTeamRolesUseCase: Symbol('GetAllTeamRolesUseCase'),

    GetAllTeamMembersUseCase: Symbol('GetAllTeamMembersUseCase'),
    UpdateTeamMemberUseCase: Symbol('UpdateTeamMemberUseCase'),
    RemoveTeamMemberUseCase: Symbol('RemoveTeamMemberUseCase'),

    GetInvitationDetailsUseCase: Symbol('GetInvitationDetailsUseCase'),
    GetPendingInvitationsUseCase: Symbol('GetPendingInvitationsUseCase'),
    SendInvitationUseCase: Symbol('SendInvitationUseCase'),
    AcceptInvitationUseCase: Symbol('AcceptInvitationUseCase'),
    RejectInvitationUseCase: Symbol('RejectInvitationUseCase'),
    CancelInvitationUseCase: Symbol('CancelInvitationUseCase')
} as const;
