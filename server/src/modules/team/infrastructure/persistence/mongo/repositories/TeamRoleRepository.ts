import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import TeamRoleModel, { TeamRoleDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamRoleModel';
import { ITeamRoleRepository } from '@modules/team/domain/port/ITeamRoleRepository';
import teamRoleMapper from '@modules/team/infrastructure/persistence/mongo/mappers/TeamRole';

import { Types } from 'mongoose';
import { FindOptions, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';

@injectable()
export default class TeamRoleRepository
    extends MongooseBaseRepository<TeamRole, TeamRoleProps, TeamRoleDocument>
    implements ITeamRoleRepository {

    constructor() {
        super(TeamRoleModel, teamRoleMapper);
    }

    override async findAll(
        options: FindOptions<TeamRoleProps> & PaginationOptions
    ): Promise<PaginatedResult<TeamRole>> {
        const { filter } = options;
        if (filter && filter.team && typeof filter.team === 'string') {
            const normalizedFilter = {
                ...filter,
                team: new Types.ObjectId(filter.team)
            } as unknown as FindOptions<TeamRoleProps>['filter'];

            return super.findAll({
                ...options,
                filter: normalizedFilter
            });
        }

        return super.findAll(options);
    }
}
