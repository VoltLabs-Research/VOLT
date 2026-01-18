import { TeamProps } from '@modules/team/domain/entities/Team';

export interface GetTeamByIdInputDTO{
    teamId: string;
};

export interface GetTeamByIdOutputDTO extends TeamProps{}