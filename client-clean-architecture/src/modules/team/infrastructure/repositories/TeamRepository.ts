import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ITeamRepository } from '../../domain/repositories';
import type { Team, CreateTeamPayload, UpdateTeamPayload } from '../../domain/entities';

export class TeamRepository extends BaseRepository implements ITeamRepository {
    constructor() {
        super('/team');
    }

    async getAll(): Promise<Team[]> {
        return this.get<Team[]>('/');
    }

    async create(data: CreateTeamPayload): Promise<Team> {
        return this.post<Team>('/', data);
    }

    async update(id: string, data: UpdateTeamPayload): Promise<Team> {
        return this.patch<Team>(`/${id}`, data);
    }

    async delete(id: string): Promise<void> {
        await this.client.request('delete', `/${id}`);
    }

    async leave(id: string): Promise<void> {
        await this.post(`/${id}/leave`);
    }

    async removeMember(teamId: string, data: { userId?: string }): Promise<void> {
        await this.post(`/${teamId}/members/remove`, data);
    }
}

export const teamRepository = new TeamRepository();
