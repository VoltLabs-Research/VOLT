import { Request, Response } from 'express';
import { Team, TeamMember, User } from '@/models';
import { FilterQuery, Types } from 'mongoose';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { Resource } from '@/constants/resources';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';

export default class TeamController extends BaseController<any>{
    constructor(){
        super(Team, {
            resource: Resource.TEAM,
            fields: ['name', 'description'],
            populate: {
                path: 'members owner admins',
                select: 'email username avatar firstName lastName lastLoginAt createdAt'
            }
        });
    }

    protected async getTeamId(req: Request, doc?: any): Promise<string>{
        return req.params.id;
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

    public leaveTeam = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const team = res.locals.team;
        const teamId = team._id;

        // Check if owner
        if(team.owner.toString() === userId.toString()){
            await Team.findByIdAndDelete(teamId);
            return res.status(200).json({ status: 'success' });
        }

        await TeamMember.deleteOne({ team: teamId, user: userId });
        await Team.findByIdAndUpdate(teamId, {
            $pull: {
                members: userId,
                admins: userId
            }
        });

        await User.findByIdAndUpdate(userId, { $pull: { teams: teamId } });

        res.status(200).json({ status: 'success' });
    });

    public removeMember = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        const team = res.locals.team;
        const { userId } = req.body;
        const userToRemove = await User.findOne({ _id: userId });
        if(!userToRemove) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if(team.owner.toString() === userToRemove._id.toString()){
            throw new RuntimeError(ErrorCodes.TEAM_CANNOT_REMOVE_OWNER, 403);
        }

        const member = await TeamMember.findOne({ team: teamId, user: userToRemove._id });
        if(!member){
            throw new RuntimeError(ErrorCodes.TEAM_USER_NOT_MEMBER, 400);
        }

        await member.deleteOne();

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