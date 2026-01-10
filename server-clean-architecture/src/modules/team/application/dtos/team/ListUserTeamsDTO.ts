import { TeamProps } from "../../../domain/entities/Team";

export interface ListUserTeamsInputDTO{
    userId: string;
};

export interface ListUserTeamsOutputDTO extends TeamProps{};