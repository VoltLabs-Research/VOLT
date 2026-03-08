import type { TeamMember } from '../entities/team-member';

export interface UpdateTeamMemberParams {
    role?: string;
};

export interface UpdateTeamMemberInputDTO {
    teamId: string;
    memberId: string;
    role?: string;
};

export type UpdateTeamMemberOutputDTO = TeamMember;
