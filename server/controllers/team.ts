import { Request, Response } from 'express';
import Team from '@models/team';
import HandlerFactory from '@/controllers/handler-factory';

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