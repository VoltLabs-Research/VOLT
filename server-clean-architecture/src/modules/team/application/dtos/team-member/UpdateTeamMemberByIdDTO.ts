import { TeamMemberProps } from "../../../domain/entities/TeamMember";

export interface UpdateTeamMemberByIdInputDTO{
    teamMemberId: string;
    roleId?: string;
};

export interface UpdateTeamMemberByIdOutputDTO extends TeamMemberProps{}