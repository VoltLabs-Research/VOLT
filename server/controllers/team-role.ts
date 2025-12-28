import { Request, Response } from 'express';
import { TeamRole, TeamMember, Team } from '@/models';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { Action, Resource } from '@/constants/permissions';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';

export default class TeamRoleController extends BaseController<any> {
    constructor() {
        super(TeamRole, {
            resourceName: 'TeamRole',
            resource: Resource.TEAM_ROLE,
            fields: ['name', 'permissions']
        });
    }

    protected async getTeamId(req: Request): Promise<string | null> {
        return req.params.teamId || req.params.id || null;
    }

    public getRoles = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        const team = await Team.findById(teamId).lean();
        if (!team) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        await this.authorize(req, teamId, Action.READ);

        const roles = await TeamRole.find({ team: teamId })
            .sort({ isSystem: -1, name: 1 })
            .lean();

        res.status(200).json({ status: 'success', data: roles });
    });

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

    public getMembers = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        await this.authorize(req, teamId, Action.READ, Resource.TEAM_MEMBER);

        const members = await TeamMember.find({ team: teamId })
            .populate('user', 'email firstName lastName avatar lastLoginAt createdAt')
            .populate('role', 'name permissions isSystem')
            .sort({ joinedAt: -1 })
            .lean();

        res.status(200).json({ status: 'success', data: members });
    });

    public assignRole = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        if (!teamId) throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);

        const { memberId } = req.params;
        const { roleId } = req.body;

        await this.authorize(req, teamId, Action.UPDATE, Resource.TEAM_MEMBER);

        const role = await TeamRole.findOne({ _id: roleId, team: teamId });
        if (!role) throw new RuntimeError(ErrorCodes.TEAM_ROLE_NOT_FOUND, 404);

        const member = await TeamMember.findOne({ _id: memberId, team: teamId });
        if (!member) throw new RuntimeError(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 404);

        const team = await Team.findById(teamId).lean();
        if (team && team.owner.toString() === member.user.toString()) {
            const ownerRole = await TeamRole.findOne({ team: teamId, name: 'Owner', isSystem: true });
            if (ownerRole && roleId !== ownerRole._id.toString()) {
                throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);
            }
        }

        member.role = role._id;
        await member.save();

        await member.populate('role', 'name permissions isSystem');
        await member.populate('user', 'email firstName lastName avatar');

        res.status(200).json({ status: 'success', data: member });
    });
}
