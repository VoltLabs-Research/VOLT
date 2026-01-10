import { HydratedDocument } from "mongoose";
import { TeamDocument } from "../models/TeamModel";
import Team, { TeamProps } from '../../../../domain/entities/Team';
import { IMapper } from "@/src/shared/infrastructure/persistence/IMapper";

class TeamMapper
    implements IMapper<Team, TeamProps, TeamDocument>{

    toDomain(doc: HydratedDocument<TeamDocument>): Team{
        const props = {
            name: doc.name,
            description: doc.description,
            owner: doc.owner._id.toString(),
            admins: doc.admins.map((admin) => admin._id.toString()),
            members: doc.members.map((member) => member._id.toString()),
            invitations: doc.invitations.map((invitation) => invitation._id.toString()),
            containers: doc.containers.map((container) => container._id.toString()),
            trajectories: doc.trajectories.map((trajectory) => trajectory._id.toString()),
            chats: doc.chats.map((chat) => chat._id.toString()),
            plugins: doc.plugins.map((plugin) => plugin._id.toString()),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };

        return new Team(doc._id.toString(), props);
    }

    toPersistence(data: TeamProps): Partial<TeamDocument>{
        return {
            name: data.name,
            description: data.description,
            owner: data.owner as any,
            admins: data.admins as any,
            members: data.members as any,
            invitations: data.invitations as any,
            containers: data.containers as any,
            trajectories: data.trajectories as any,
            chats: data.chats as any,
            plugins: data.plugins as any
        };
    }
};

export default new TeamMapper();