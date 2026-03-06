import { injectable } from 'tsyringe';
import ITeamStorage from '../../domain/port/ITeamStorage';

const SELECTED_TEAM_KEY = 'selectedTeamId';
const TEAM_PERMISSIONS_KEY = 'teamPermissionsByTeamId';

type TeamPermissionsCache = Record<string, string[]>;

@injectable()
export default class TeamStorage implements ITeamStorage{
    private getPermissionsMap(): TeamPermissionsCache {
        const raw = localStorage.getItem(TEAM_PERMISSIONS_KEY);
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw) as TeamPermissionsCache;
            if (!parsed || typeof parsed !== 'object') return {};
            return parsed;
        } catch {
            return {};
        }
    }

    private setPermissionsMap(cache: TeamPermissionsCache): void {
        localStorage.setItem(TEAM_PERMISSIONS_KEY, JSON.stringify(cache));
    }

    getSelectedTeamId(): string | null{
        return localStorage.getItem(SELECTED_TEAM_KEY);
    }

    setSelectedTeamId(teamId: string): void{
        localStorage.setItem(SELECTED_TEAM_KEY, teamId);
    }

    clearSelectedTeamId(): void{
        localStorage.removeItem(SELECTED_TEAM_KEY);
    }

    getTeamPermissions(teamId: string): string[] | null {
        const cache = this.getPermissionsMap();
        const permissions = cache[teamId];
        if (!Array.isArray(permissions)) return null;
        return permissions;
    }

    setTeamPermissions(teamId: string, permissions: string[]): void {
        const cache = this.getPermissionsMap();
        cache[teamId] = Array.from(new Set(permissions));
        this.setPermissionsMap(cache);
    }

    clearTeamPermissions(teamId: string): void {
        const cache = this.getPermissionsMap();
        if (!(teamId in cache)) return;
        delete cache[teamId];
        this.setPermissionsMap(cache);
    }
};
