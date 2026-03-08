import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import { TeamRoleDocument } from '@modules/team/infrastructure/persistence/mongo/models/team-role/TeamRoleModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamRole, TeamRoleProps, TeamRoleDocument>(TeamRole, ['team']);
