import type { Team, CreateTeamPayload, UpdateTeamPayload } from '../entities';

export interface ITeamRepository {
    getAll(): Promise<Team[]>;
    create(data: CreateTeamPayload): Promise<Team>;
    update(id: string, data: UpdateTeamPayload): Promise<Team>;
    delete(id: string): Promise<void>;
    leave(id: string): Promise<void>;
    removeMember(teamId: string, data: { userId?: string }): Promise<void>;
}
