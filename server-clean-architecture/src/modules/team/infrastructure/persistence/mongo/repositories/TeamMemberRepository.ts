import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';
import TeamMemberModel, { TeamMemberDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamMemberModel';
import teamMemberMapper from '@modules/team/infrastructure/persistence/mongo/mappers/TeamMemberMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class TeamMemberRepository
    extends MongooseBaseRepository<TeamMember, TeamMemberProps, TeamMemberDocument>
    implements ITeamMemberRepository{

    constructor(){
        super(TeamMemberModel, teamMemberMapper);
    }
};