import { ITeamRepository } from "@/src/modules/team/domain/ports/ITeamRepository";
import Team, { TeamProps } from '../../../../domain/entities/Team';
import TeamModel, { TeamDocument } from '../models/TeamModel';
import teamMapper from "../mappers/TeamMapper";
import { injectable } from "tsyringe";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";

@injectable()
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument>
    implements ITeamRepository{

    constructor(){
        super(TeamModel, teamMapper);
    }

    async removeUserFromAllTeams(userId: string): Promise<void> {
        // Remove user from members arrays of all teams
        await this.model.updateMany(
            { members: userId },
            { $pull: { members: userId } }
        );

        // Remove user from admins arrays of all teams
        await this.model.updateMany(
            { admins: userId },
            { $pull: { admins: userId } }
        );
    }

    async hasAccess(userId: string, teamId: string): Promise<boolean>{
        const result = await this.model.exists({
            _id: teamId,
            $or: [
                { members: userId },
                { admins: userId },
                { owner: userId }
            ]
        });

        return result !== undefined;
    }

    async removeUserFromTeam(userId: string, teamId: string): Promise<void>{
        // await TeamMember.deleteOne(...)
        await this.model.findByIdAndUpdate(teamId, {
            $pull: {
                members: userId,
                admins: userId
            }
        });
    }

    async findUserTeams(userId: string): Promise<TeamProps[]> {
        const docs = await this.model.find({ members: userId });
        return docs.map((doc) => this.mapper.toDomain(doc).props);
    }
}