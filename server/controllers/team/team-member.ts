import { Request } from 'express';
import { TeamMember, Team } from '@/models';
import { ITeamMember } from '@/models/team/team-member';
import { FilterQuery, Types } from 'mongoose';
import { ErrorCodes } from '@/constants/error-codes';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';

export default class TeamMemberController extends BaseController<ITeamMember>{
    constructor(){
        super(TeamMember, {
            resource: Resource.TEAM_MEMBER,
            fields: ['role'],
            populate: [
                { path: 'role', select: 'name permissions isSystem' },
                { path: 'user', select: 'email firstName lastName avatar' }
            ]
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<ITeamMember>> {
        const teamId = await this.getTeamId(req);
        return { team: new Types.ObjectId(teamId) };
    }

    protected async onBeforeUpdate(data: Partial<ITeamMember>, req: Request, currentDoc: ITeamMember): Promise<Partial<ITeamMember>> {
        const teamId = await this.getTeamId(req);
        const team = await Team.findById(teamId).select('owner').lean();
        // The user with the owner role (the team creator) should not be able to change their role to a different one.
        if(team && team.owner.toString() === currentDoc.user.toString()){
            throw new RuntimeError(ErrorCodes.TEAM_ROLE_IS_SYSTEM, 400);
        }
        return data;
    }
};