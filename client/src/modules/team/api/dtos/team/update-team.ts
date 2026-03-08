import type { Team } from '../../entities/team';

export interface UpdateTeamParams {
    name?: string;
    description?: string;
};

export interface UpdateTeamInputDTO {
    teamId: string;
    name?: string;
    description?: string;
};

export type UpdateTeamOutputDTO = Team;
