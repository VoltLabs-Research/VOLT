import { Request } from 'express';
import { TeamRole, TeamMember } from '@/models';
import { ErrorCodes } from '@/constants/error-codes';
import { Resource } from '@/constants/resources';
import { ITeamRole } from '@/models/team-role';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';
import { FilterQuery } from 'mongoose';

export default class TeamRoleController extends BaseController<ITeamRole> {
    constructor() {
        super(TeamRole, {
            resource: Resource.TEAM_ROLE,
            fields: ['name', 'permissions']
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<ITeamRole>> {
        const teamId = await this.getTeamId(req);
        return { team: teamId };
    }

    protected async onBeforeCreate(data: Partial<ITeamRole>, req: Request): Promise<Partial<ITeamRole>> {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);
        if (!data.name) throw new RuntimeError(ErrorCodes.TEAM_ROLE_NAME_REQUIRED, 400);

        return {
            ...data,
            team: teamId as any,
            permissions: data.permissions || [],
            isSystem: false
        };
    }

    protected async onBeforeUpdate(data: Partial<ITeamRole>, req: Request, currentDoc: ITeamRole): Promise<Partial<ITeamRole>> {
        // Prevent renaming system roles
        if (currentDoc.isSystem && data.name && data.name !== currentDoc.name) {
            throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);
        }
        // For system roles, only allow permission updates
        if (currentDoc.isSystem) {
            return { permissions: data.permissions };
        }
        return data;
    }

    protected async onBeforeDelete(doc: ITeamRole, req: Request): Promise<void> {
        if (doc.isSystem) {
            throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);
        }

        const teamId = await this.getTeamId(req);
        const membersWithRole = await TeamMember.countDocuments({ team: teamId, role: doc._id });
        if (membersWithRole > 0) {
            throw new RuntimeError(ErrorCodes.TEAM_ROLE_IN_USE, 400);
        }
    }
}
