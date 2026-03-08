import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';
import { TeamRoleDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamRoleModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamRole, TeamRoleProps, TeamRoleDocument>(TeamRole, ['team']);
