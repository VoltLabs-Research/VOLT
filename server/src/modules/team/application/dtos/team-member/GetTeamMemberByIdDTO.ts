import { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface GetTeamMemberByIdInputDTO{
    teamMemberId: string;
};

export interface GetTeamMemberByIdOutputDTO extends TeamMemberProps{}