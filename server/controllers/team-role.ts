import { Request, Response } from 'express';
import { TeamRole, TeamMember, Team } from '@/models';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { Action, Resource } from '@/constants/permissions';
import { ITeamRole } from '@/models/team-role';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';
import { FilterQuery } from 'mongoose';

export default class TeamRoleController extends BaseController<ITeamRole> {
    constructor() {
        super(TeamRole, {
            resourceName: 'TeamRole',
            resource: Resource.TEAM_ROLE,
            fields: ['name', 'permissions']
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<ITeamRole>> {
        const teamId = await this.getTeamId(req);
        return { team: teamId };
    }

    public createRole = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        const { name, permissions } = req.body;
        if (!name) throw new RuntimeError(ErrorCodes.TEAM_ROLE_NAME_REQUIRED, 400);

        await this.authorize(req, teamId, Action.CREATE);

        const role = await TeamRole.create({
            team: teamId,
            name,
            permissions: permissions || [],
            isSystem: false
        });

        res.status(201).json({ status: 'success', data: role });
    });

    public updateRole = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        const { roleId } = req.params;
        const { name, permissions } = req.body;

        await this.authorize(req, teamId, Action.UPDATE);

        const role = await TeamRole.findOne({ _id: roleId, team: teamId });
        if (!role) throw new RuntimeError(ErrorCodes.TEAM_ROLE_NOT_FOUND, 404);

        if (role.isSystem && name && name !== role.name) {
            throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);
        }

        if (!role.isSystem && name) role.name = name;
        if (permissions) role.permissions = permissions;

        await role.save();
        res.status(200).json({ status: 'success', data: role });
    });

    public deleteRole = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        const { roleId } = req.params;

        await this.authorize(req, teamId, Action.DELETE);

        const role = await TeamRole.findOne({ _id: roleId, team: teamId });
        if (!role) throw new RuntimeError(ErrorCodes.TEAM_ROLE_NOT_FOUND, 404);

        if (role.isSystem) throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);

        const membersWithRole = await TeamMember.countDocuments({ team: teamId, role: roleId });
        if (membersWithRole > 0) throw new RuntimeError(ErrorCodes.TEAM_ROLE_IN_USE, 400);

        await role.deleteOne();
        res.status(204).json({ status: 'success', data: null });
    });
}
