import type { TeamMemberWithRole } from '../entities';

export interface ITeamRoleAssignmentRepository {
    assignRole(memberId: string, roleId: string): Promise<TeamMemberWithRole>;
}
