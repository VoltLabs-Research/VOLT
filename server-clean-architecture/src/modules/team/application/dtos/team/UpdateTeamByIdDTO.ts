import { TeamProps } from "../../../domain/entities/Team";

export interface UpdateTeamByIdInputDTO{
    name: string;
    description: string;
    teamId: string;
};

export interface UpdateTeamByIdOutputDTO extends TeamProps{}