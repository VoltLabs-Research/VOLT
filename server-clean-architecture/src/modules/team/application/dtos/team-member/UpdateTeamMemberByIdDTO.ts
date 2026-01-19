import { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface UpdateTeamMemberByIdInputDTO {
    teamMemberId: string;
    role?: string;
};

export interface UpdateTeamMemberByIdOutputDTO extends TeamMemberProps { }