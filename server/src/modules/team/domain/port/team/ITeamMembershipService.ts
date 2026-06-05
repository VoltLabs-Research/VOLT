export interface ITeamMembershipService {
    removeMemberFromTeam(memberId: string, teamId: string): Promise<void>;
}
