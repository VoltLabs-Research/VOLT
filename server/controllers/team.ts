import { Request, Response } from 'express';
import { Team, User } from '@models/index';
import HandlerFactory from '@/controllers/handler-factory';
import { catchAsync } from '@/utilities/runtime';
import createHttpError from 'http-errors';

const factory = new HandlerFactory({
    model: Team,
    fields: ['name', 'description'],
    populate: {
        withMembers: 'owner members'
    },
    errorMessages: {
        default: {
            notFound: 'Team::NotFound',
            validation: 'Team::ValidationError',
            unauthorized: 'Team::AccessDenied'
        }
    },
    defaultPopulate: 'withMembers',
    defaultErrorConfig: 'default'
});

export const createTeam = factory.createOne({
    requiredFields: ['name'],
    beforeCreate: async (data: any, req: Request) => {
        const userId = (req as any).user.id;
        return {
            ...data,
            owner: userId,
            members: [userId]
        };
    },
});

export const getUserTeams = factory.getAll({
    customFilter: async (req: Request) => {
        const userId = (req as any).user.id;
        return { members: userId };
    },
    populateConfig: 'withMembers'
});

export const getTeamById = factory.getOne({ populateConfig: 'withMembers' });
export const updateTeam = factory.updateOne();
export const deleteTeam = factory.deleteOne();

// Get team members with their details
export const getTeamMembers = catchAsync(async (req: Request, res: Response) => {
    const teamId = req.params.id;
    const userId = (req as any).user._id;

    if (!teamId) {
        throw createHttpError(400, 'Team::NotFound');
    }

    // Find the team and populate members
    const team = await Team.findById(teamId).populate('members', 'email username avatar');
    
    if (!team) {
        throw createHttpError(404, 'Team::NotFound');
    }

    // Check if user is a member of the team
    if (!team.members.some((member: any) => member._id.toString() === userId.toString())) {
        throw createHttpError(403, 'Team::AccessDenied');
    }

    res.status(200).json({
        status: 'success',
        data: {
            members: team.members
        }
    });
});

// Leave team or delete if owner - remove current user from team or delete team
export const leaveTeam = catchAsync(async (req: Request, res: Response) => {
    const teamId = req.params.id;
    const userId = (req as any).user._id;

    if (!teamId) {
        throw createHttpError(400, 'Team::NotFound');
    }

    // Find the team
    const team = await Team.findById(teamId);
    if (!team) {
        throw createHttpError(404, 'Team::NotFound');
    }

    // Check if user is a member
    if (!team.members.some(member => member.toString() === userId.toString())) {
        throw createHttpError(403, 'Team::AccessDenied');
    }

    // If user is the owner, delete the team
    if (team.owner.toString() === userId.toString()) {
        await Team.findByIdAndDelete(teamId);
        return res.status(200).json({
            status: 'success',
            message: 'Team deleted successfully'
        });
    }

    // Otherwise, remove user from team members
    team.members = team.members.filter(member => member.toString() !== userId.toString());
    await team.save();

    res.status(200).json({
        status: 'success',
        message: 'Left team successfully'
    });
});

// Remove member from team (only owner can do this)
export const removeMember = catchAsync(async (req: Request, res: Response) => {
    const teamId = req.params.id;
    const { email } = req.body;
    const userId = (req as any).user._id;

    if (!teamId || !email) {
        throw createHttpError(400, 'Team::InvalidRequest');
    }

    // Find the team
    const team = await Team.findById(teamId);
    if (!team) {
        throw createHttpError(404, 'Team::NotFound');
    }

    // Check if user is the owner
    if (team.owner.toString() !== userId.toString()) {
        throw createHttpError(403, 'Team::OnlyOwnerCanRemoveMembers');
    }

    // Find the user to remove by email
    const userToRemove = await User.findOne({ email });
    if (!userToRemove) {
        throw createHttpError(404, 'User::NotFound');
    }

    // Check if the user is a member of the team
    if (!team.members.some((memberId) => memberId.toString() === userToRemove._id.toString())) {
        throw createHttpError(400, 'Team::UserNotAMember');
    }

    // Prevent owner from removing themselves
    if (team.owner.toString() === userToRemove._id.toString()) {
        throw createHttpError(403, 'Team::CannotRemoveOwner');
    }

    // Remove user from team members
    await Team.findByIdAndUpdate(
        teamId,
        { $pull: { members: userToRemove._id } },
        { new: true }
    );

    // Remove team from user's teams
    await User.findByIdAndUpdate(
        userToRemove._id,
        { $pull: { teams: teamId } }
    );

    res.status(200).json({
        status: 'success',
        message: 'Member removed successfully'
    });
});