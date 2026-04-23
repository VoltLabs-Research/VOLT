import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import teamRoleMapper from '@modules/team/infrastructure/persistence/mongo/mappers/team-role/TeamRoleMapper';
import TeamRoleModel, { TeamRoleDocument } from '@modules/team/infrastructure/persistence/mongo/models/team-role/TeamRoleModel';
import { FindOptions, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { Types } from 'mongoose';


type TeamRoleFilter = Record<string, unknown>;

@Singleton()
export default class TeamRoleRepository
    extends MongooseBaseRepository<TeamRole, TeamRoleProps, TeamRoleDocument> {

    constructor() {
        super(TeamRoleModel, teamRoleMapper);
    }

    override async findAll(
        options: FindOptions<TeamRoleProps> & PaginationOptions
    ): Promise<PaginatedResult<TeamRole>> {
        const { filter } = options;
        if (filter && filter.team && typeof filter.team === 'string') {
            const normalizedFilter: TeamRoleFilter = {
                ...filter,
                team: new Types.ObjectId(filter.team)
            };

            return super.findAll({
                ...options,
                filter: normalizedFilter
            });
        }

        return super.findAll(options);
    }
};
