import { injectable } from 'tsyringe';
import { IPermissionStrategy, IAccessControlSubject } from '@shared/domain/ports/IAccessControlService';
import TeamModel from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import TeamMemberModel from '@modules/team/infrastructure/persistence/mongo/models/TeamMemberModel';

@injectable()
export class UserStrategy implements IPermissionStrategy {
    async getPermissions(subject: IAccessControlSubject, teamId: string): Promise<string[]> {
        const team = await TeamModel.findById(teamId)
            .select('owner')
            .lean();

        if (!team) return [];

        // Team owner has all permissions
        if (team.owner.toString() === subject.id) {
            return ['*'];
        }

        // Get member's role and permissions
        const membership = await TeamMemberModel.findOne({
            team: teamId,
            user: subject.id
        })
            .populate<{ role: { permissions: string[] } }>('role', 'permissions')
            .lean();

        if (!membership || !membership.role) return [];

        return membership.role.permissions || [];
    }
}
