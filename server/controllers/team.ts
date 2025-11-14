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

// Leave team - remove current user from team
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
    if (!team.members.includes(userId)) {
        throw createHttpError(403, 'Team::AccessDenied');
    }

    // Check if user is trying to leave their own team (owner)
    if (team.owner.toString() === userId.toString()) {
        throw createHttpError(403, 'Team::OwnerCannotLeave');
    }

    // Check if this is the user's last team
    const userTeamCount = await Team.countDocuments({ members: userId });
    if (userTeamCount <= 1) {
        throw createHttpError(400, 'Team::CannotLeaveLastTeam');
    }

    // Remove user from team members
    await Team.findByIdAndUpdate(
        teamId,
        { $pull: { members: userId } },
        { new: true }
    );

    // Remove team from user's teams
    await User.findByIdAndUpdate(
        userId,
        { $pull: { teams: teamId } }
    );

    res.status(200).json({
        status: 'success',
        message: 'Left team successfully'
    });
});