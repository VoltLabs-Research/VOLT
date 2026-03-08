import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';
import { TeamMemberDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamMemberModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamMember, TeamMemberProps, TeamMemberDocument>(TeamMember, [
    'team',
    'user',
    'role'
]);
