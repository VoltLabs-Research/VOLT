import { TeamMemberProps } from "../../../domain/entities/TeamMember";

export interface GetTeamMemberByIdInputDTO{
    teamMemberId: string;
};

export interface GetTeamMemberByIdOutputDTO extends TeamMemberProps{}