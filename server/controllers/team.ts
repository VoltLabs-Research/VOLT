import { Request, Response } from 'express';
import { Team, User } from '@/models';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';

export default class TeamController extends BaseController<any> {
    constructor(){
        super(Team, {
            resourceName: 'Team',
            fields: ['name', 'description'],
            populate: { path: 'members owner', select: 'email username avatar firstName lastName' }
        })
    }

    /**
     * Users can only see teams they are members of.
     */
    protected async getFilter(req: Request): Promise<FilterQuery<any>>{
        const userId = (req as any).user.id;
        return { members: userId };
    }

    /**
     * Automatically set owner and add owner to members.
     */
    protected async onBeforeCreate(data: Partial<any>, req: Request): Promise<Partial<any>>{
        const userId = (req as any).user.id;
        return {
            ...data,
            owner: userId,
            members: [userId]
        };
    }

    public getMembers = catchAsync(async(req: Request, res: Response) => {
        const teamId = req.params.id;
        const team = await Team.findById(teamId).populate('members', 'email username avatar firstName lastName');

        if(!team) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        res.status(200).json({
            status: 'success', data: { members: team.members }
        });
    });

    public leaveTeam = catchAsync(async(req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const team = res.locals.team;
        const teamId = team._id;

        // If owner, delete team
        if(team.owner.toString() === userId.toString()) {
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

    public removeMember = catchAsync(async(req: Request, res: Response) => {
        const teamId = req.params.id;
        const { email } = req.body;
        const team = res.locals.team;

        const userToRemove = await User.findOne({ email });
        if(!userToRemove) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if(team.owner.toString() === userToRemove._id.toString()) {
            throw new RuntimeError(ErrorCodes.TEAM_CANNOT_REMOVE_OWNER, 403);
        }

        if(!team.members.some((m: any) => m.toString() === userToRemove._id.toString())) {
            throw new RuntimeError(ErrorCodes.TEAM_USER_NOT_MEMBER, 400);
        }

        await Team.findByIdAndUpdate(teamId, { $pull: { members: userToRemove._id } });
        await User.findByIdAndUpdate(userToRemove._id, { $pull: { teams: teamId } });

        res.status(200).json({ status: 'success' });
    });
};
