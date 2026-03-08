import { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<Team, TeamProps, TeamDocument>(Team, [
    'owner',
    'admins',
    'members',
    'invitations',
    'containers',
    'trajectories',
    'chats',
    'plugins'
]);
