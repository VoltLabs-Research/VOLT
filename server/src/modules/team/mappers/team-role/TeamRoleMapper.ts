import TeamRole, { TeamRoleProps } from '@modules/team/entities/team-role/TeamRole';
import { TeamRoleDocument } from '@modules/team/models/team-role/TeamRoleModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamRole, TeamRoleProps, TeamRoleDocument>(TeamRole, ['team']);
