import TeamMember, { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import { TeamMemberDocument } from '@modules/team/models/team-member/TeamMemberModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamMember, TeamMemberProps, TeamMemberDocument>(TeamMember, [
    'team',
    'user',
    'role'
]);
