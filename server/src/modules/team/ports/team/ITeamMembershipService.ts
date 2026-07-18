export interface ITeamMembershipService {
    addMemberToTeam(userId: string, teamId: string, roleName?: string): Promise<void>;
    removeMemberFromTeam(memberId: string, teamId: string): Promise<void>;
}
