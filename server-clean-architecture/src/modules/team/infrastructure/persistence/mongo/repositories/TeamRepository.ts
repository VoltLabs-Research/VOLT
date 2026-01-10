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

    async removeUserFromTeam(userId: string, teamId: string): Promise<void>{
        // await TeamMember.deleteOne(...)
        await TeamModel.findByIdAndUpdate(teamId, {
            $pull: {
                members: userId,
                admins: userId
            }
        });
    }
}