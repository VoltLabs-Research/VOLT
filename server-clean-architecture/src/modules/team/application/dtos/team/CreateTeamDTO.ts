import { TeamProps } from "../../../domain/entities/Team";

export interface CreateTeamInputDTO{
    name: string;
    description: string;
    ownerId: string;
};

export interface CreateTeamOutputDTO extends TeamProps{}