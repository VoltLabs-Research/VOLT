import { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface UpdateTeamMemberByIdInputDTO{
    teamMemberId: string;
    roleId?: string;
};

export interface UpdateTeamMemberByIdOutputDTO extends TeamMemberProps{}