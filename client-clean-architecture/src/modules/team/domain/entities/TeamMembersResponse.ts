import type { TeamMember } from './TeamMember';

export interface TeamMembersResponse {
    members: TeamMember[];
    admins: TeamMember[];
    owner: TeamMember | null;
}
