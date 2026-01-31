import { TeamRole } from '../entities';

export interface CreateTeamRoleParams{
    name: string;
    permissions: string[];
};

export interface UpdateTeamRoleParams{
    name?: string;
    permissions?: string[];
};

export default interface ITeamRoleRepository{
    getAll(teamId: string): Promise<TeamRole[]>;
    create(teamId: string, data: CreateTeamRoleParams): Promise<TeamRole>;
    update(teamId: string, roleId: string, data: UpdateTeamRoleParams): Promise<TeamRole>;
    delete(teamId: string, roleId: string): Promise<void>;
};
