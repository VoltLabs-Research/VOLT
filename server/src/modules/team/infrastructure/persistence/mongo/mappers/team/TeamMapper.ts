import { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/team/TeamModel';
import Team, { TeamProps } from '@modules/team/domain/entities/team/Team';
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
