import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ITeamRoleAssignmentRepository } from '../../domain/repositories';
import type { TeamMemberWithRole } from '../../domain/entities';

export class TeamRoleAssignmentRepository extends BaseRepository implements ITeamRoleAssignmentRepository {
    constructor() {
        super('/team/members', { useRBAC: true });
    }

    async assignRole(memberId: string, roleId: string): Promise<TeamMemberWithRole> {
        return this.patch<TeamMemberWithRole>(`/${memberId}`, { role: roleId });
    }
}

export const teamRoleAssignmentRepository = new TeamRoleAssignmentRepository();
