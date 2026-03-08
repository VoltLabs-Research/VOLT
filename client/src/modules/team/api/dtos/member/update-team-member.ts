import type { TeamMember } from '../../entities/member';

export interface UpdateTeamMemberParams {
    role?: string;
};

export interface UpdateTeamMemberInputDTO {
    teamId: string;
    memberId: string;
    role?: string;
};

export type UpdateTeamMemberOutputDTO = TeamMember;
