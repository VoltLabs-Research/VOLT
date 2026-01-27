import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import { getTeamId } from '@/shared/infrastructure/api';
import type { ITeamRoleRepository } from '../../domain/repositories';
import type { TeamRole, TeamRolePayload } from '../../domain/entities';

export class TeamRoleRepository extends BaseRepository implements ITeamRoleRepository {
    constructor() {
        super('/team/roles', { useRBAC: true });
    }

    async getAll(): Promise<TeamRole[]> {
        const payload = await this.get<any>('/');
        if (Array.isArray(payload)) return payload;
        return Array.isArray(payload?.data) ? payload.data : [];
    }

    async create(data: TeamRolePayload): Promise<TeamRole> {
        return this.post<TeamRole>('/', { ...data, teamId: getTeamId() });
    }

    async update(roleId: string, data: Partial<TeamRolePayload>): Promise<TeamRole> {
        return this.patch<TeamRole>(`/${roleId}`, data);
    }

    async deleteRole(roleId: string): Promise<void> {
        await this.delete(`/${roleId}`);
    }
}

export const teamRoleRepository = new TeamRoleRepository();
