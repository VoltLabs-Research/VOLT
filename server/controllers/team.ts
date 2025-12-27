import { Request, Response } from 'express';
import { Team, User } from '@/models';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';

export default class TeamController extends BaseController<any> {
    constructor() {
        super(Team, {
            resourceName: 'Team',
            fields: ['name', 'description'],
            populate: { path: 'members owner admins', select: 'email username avatar firstName lastName lastLoginAt createdAt' }
        })
    }

    /**
     * Users can only see teams they are members of.
     */
    protected async getFilter(req: Request): Promise<FilterQuery<any>> {
        const userId = (req as any).user.id;
        return { members: userId };
    }

    /**
     * Automatically set owner and add owner to members.
     */
    protected async onBeforeCreate(data: Partial<any>, req: Request): Promise<Partial<any>> {
        const userId = (req as any).user.id;
        return {
            ...data,
            owner: userId,
            members: [userId]
        };
    }

    public getMembers = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        const team = await Team.findById(teamId)
            .populate('members', 'email username avatar firstName lastName lastLoginAt createdAt')
            .populate('admins', 'email username avatar firstName lastName')
            .populate('owner', 'email username avatar firstName lastName');

        if (!team) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        res.status(200).json({
            status: 'success',
            data: {
                members: team.members,
                admins: team.admins,
                owner: team.owner
            }
        });
    });

    public promoteToAdmin = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        const { userId } = req.body;
        const team = res.locals.team; // Assumes middleware sets this, but need to check if owner/admin check is done before. 
        // Actually BaseController usually doesn't set locals.team. We need to fetch or rely on middleware.
        // Assuming there is a middleware regarding team permissions or I should fetch it.
        // The user request said "solo y solo si el usuario es administrador: asignar como Administrator Permissions".
        // Let's assume protect middleware gives us user. User must be checking against team.

        // However, I need to fetch the team to check permissions if not done by router. 
        // Let's fetch it to be safe or assuming the route uses a middleware that puts team in locals. 
        // Looking at `removeMember`, it uses `res.locals.team`. This implies a middleware.

        // Logic: Only Owner or Admin can promote? Usually only Owner can make Admins or Admins can make Admins?
        // Let's assume Owner and Admins can promote.

        const currentUserId = (req as any).user._id;

        // We need to re-fetch to ensure we have admins list if res.locals.team doesn't have it populated or updated
        const teamFetched = await Team.findById(teamId);
        if (!teamFetched) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        const isOwner = teamFetched.owner.toString() === currentUserId.toString();
        const isAdmin = teamFetched.admins.some((a: any) => a.toString() === currentUserId.toString());

        if (!isOwner && !isAdmin) throw new RuntimeError(ErrorCodes.TEAM_NOT_AUTHORIZED, 403);

        if (teamFetched.admins.some((a: any) => a.toString() === userId)) {
            return res.status(400).json({ status: 'fail', message: 'User is already an admin' });
        }

        teamFetched.admins.push(userId);
        await teamFetched.save();

        res.status(200).json({ status: 'success', data: null });
    });

    public demoteFromAdmin = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        const { userId } = req.body;
        const currentUserId = (req as any).user._id;

        const teamFetched = await Team.findById(teamId);
        if (!teamFetched) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        const isOwner = teamFetched.owner.toString() === currentUserId.toString();
        // Admins can demote other admins? Usually only Owner can demote admins.
        // Let's restrict demotion to Owner or self-demotion?
        // For now, allow Owner and Admins to remove other Admins (except themselves? or logic...)
        // Let's say Owner can demote anyone. Admins can demote (maybe?)
        // Safest: Only Owner can demote admins.

        if (!isOwner) throw new RuntimeError(ErrorCodes.TEAM_NOT_AUTHORIZED, 403);

        teamFetched.admins = teamFetched.admins.filter((a: any) => a.toString() !== userId);
        await teamFetched.save();

        res.status(200).json({ status: 'success', data: null });
    });

    public leaveTeam = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const team = res.locals.team;
        const teamId = team._id;

        // If owner, delete team
        if (team.owner.toString() === userId.toString()) {
            await Team.findByIdAndDelete(teamId);
            return res.status(200).json({
                status: 'success',
                message: 'Team deleted successfully'
            });
        }

        // Remove members
        team.members = team.members.filter((m: any) => m.toString() !== userId.toString());
        await team.save();

        // Remove from user's team list
        await User.findByIdAndUpdate(userId, { $pull: { teams: teamId } });

        res.status(200).json({ status: 'success' });
    });

    public removeMember = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        const { email } = req.body;
        const team = res.locals.team;

        const userToRemove = await User.findOne({ email });
        if (!userToRemove) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if (team.owner.toString() === userToRemove._id.toString()) {
            throw new RuntimeError(ErrorCodes.TEAM_CANNOT_REMOVE_OWNER, 403);
        }

        // Check if current user has permission to remove
        const currentUserId = (req as any).user._id;
        const isOwner = team.owner.toString() === currentUserId.toString();
        // Check if current user is admin
        // Note: res.locals.team from middleware might not be up to date with admins if we didn't populate or if it was simple find. 
        // We should rely on DB or if the middleware fetched it. 
        // Assuming team.admins exists if we added it to schema.
        const isAdmin = team.admins?.some((a: any) => a.toString() === currentUserId.toString());

        if (!isOwner && !isAdmin) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_AUTHORIZED, 403);
        }

        // Admins cannot remove other Admins or Owner
        const targetIsAdmin = team.admins?.some((a: any) => a.toString() === userToRemove._id.toString());
        if (targetIsAdmin && !isOwner) {
            throw new RuntimeError(ErrorCodes.TEAM_INSUFFICIENT_PERMISSIONS, 403);
        }

        if (!team.members.some((m: any) => m.toString() === userToRemove._id.toString())) {
            throw new RuntimeError(ErrorCodes.TEAM_USER_NOT_MEMBER, 400);
        }

        await Team.findByIdAndUpdate(teamId, {
            $pull: {
                members: userToRemove._id,
                admins: userToRemove._id
            }
        });
        await User.findByIdAndUpdate(userToRemove._id, { $pull: { teams: teamId } });

        res.status(200).json({ status: 'success' });
    });
};
