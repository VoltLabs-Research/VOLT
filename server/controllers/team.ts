import { Request, Response } from 'express';
import { Analysis, DailyActivity, Team, TeamMember, Trajectory, User } from '@/models';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { Resource, Action } from '@/constants/permissions';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';

export default class TeamController extends BaseController<any>{
    constructor(){
        super(Team, {
            resourceName: 'Team',
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

    public getMembers = catchAsync(async (req: Request, res: Response) => {
        const teamId = req.params.id;
        console.log('here');
        await this.authorize(req, teamId, Action.READ, Resource.TEAM_MEMBER);

        const members = await TeamMember.find({ team: teamId })
            .populate('user', 'email avatar firstName lastName lastLoginAt createdAt')
            .populate('role', 'name permissions isSystem')
            .lean();
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const memberStats = await Promise.all(members.map(async (member: any) => {
            const userId = member.user._id;

            // Time spent last 7 days
            const dailyActivities = await DailyActivity.find({
                team: teamId,
                user: userId,
                date: { $gte: sevenDaysAgo }
            });

            // TODO: mongo aggregation maybe?
            const minutesOnline = dailyActivities.reduce((acc, curr) => acc + (curr.minutesOnline || 0), 0);

            const trajectoriesCount = await Trajectory.countDocuments({ team: teamId, createdBy: userId });
            const analysesCount = await Analysis.countDocuments({
                trajectory: { $in: await Trajectory.find({ team: teamId }).distinct('_id') },
                createdBy: userId
            });

            return {
                ...member.user,
                _id: member.user._id,
                role: member.role,
                teamMemberId: member._id,
                timeSpentLast7Days: minutesOnline,
                trajectoriesCount,
                analysesCount: analysesCount,
                joinedAt: member.joinedAt || member.createdAt
            };
        }));

        const ownerMember = memberStats.find((member: any) => member.role?.name === 'Owner');
        const adminMembers = memberStats.find((member: any) => member.role?.name === 'Admin') ?? [];

        res.status(200).json({
            status: 'success',
            data: {
                members: memberStats,
                admins: adminMembers,
                owner: ownerMember
            }
        })
    });

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
        const { email } = req.body;

        const userToRemove = await User.findOne({ email });
        if(!userToRemove) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if(team.owner.toString() === userToRemove._id.toString()){
            throw new RuntimeError(ErrorCodes.TEAM_CANNOT_REMOVE_OWNER, 403);
        }

        const currentUserId = (req as any).user._id;
        await this.authorize(req, teamId, Action.DELETE, Resource.TEAM_MEMBER);

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