import { Team, TeamRole, TeamMember } from '@/models';
import { IPermissionStrategy, IAccessControlSubject } from '@/services/access-control/interfaces';

export default class UserStrategy implements IPermissionStrategy {
    async getPermissions(subject: IAccessControlSubject, teamId: string): Promise<string[]> {
        const team = await Team.findById(teamId)
            .select('owner')
            .lean();

        if (!team) return [];

        if (team.owner.toString() === subject.id) {
            return ['*'];
        }

        const membership = await TeamMember.findOne({
            team: teamId,
            user: subject.id
        })
            .populate<{ role: { permissions: string[] } }>('role', 'permissions')
            .lean();

        if (!membership || !membership.role) return [];

        return membership.role.permissions || [];
    }
}