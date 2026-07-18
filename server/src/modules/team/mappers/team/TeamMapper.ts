import { TeamDocument } from '@modules/team/models/team/TeamModel';
import Team, { TeamProps } from '@modules/team/entities/team/Team';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<Team, TeamProps, TeamDocument>(Team, [
    'owner'
]);
