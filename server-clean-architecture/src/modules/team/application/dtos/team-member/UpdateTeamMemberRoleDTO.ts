import { TeamMemberProps } from '../../../domain/entities/TeamMember';

export interface UpdateTeamMemberRoleInputDTO {
    teamMemberId: string;
    teamId: string;
    newRoleId: string;
}

export interface UpdateTeamMemberRoleOutputDTO extends TeamMemberProps {}
