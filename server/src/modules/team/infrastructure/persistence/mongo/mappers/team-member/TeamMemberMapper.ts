import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';
import { TeamMemberDocument } from '@modules/team/infrastructure/persistence/mongo/models/team-member/TeamMemberModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamMember, TeamMemberProps, TeamMemberDocument>(TeamMember, [
    'team',
    'user',
    'role'
]);
