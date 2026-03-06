import { Team } from '../entities';

export interface CreateTeamParams{
    name: string;
    description?: string;
};

export interface UpdateTeamParams{
    name?: string;
    description?: string;
};

export default interface ITeamRepository{
    getAll(): Promise<Team[]>;
    create(data: CreateTeamParams): Promise<Team>;
    update(id: string, data: UpdateTeamParams): Promise<Team>;
    delete(id: string): Promise<void>;
    leave(id: string): Promise<void>;
    getMyPermissions(teamId: string): Promise<string[]>;
};
