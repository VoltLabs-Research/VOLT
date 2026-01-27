import type { Team, TeamMember } from '../entities';

export class TeamSelectionService {
    selectInitialTeam(teams: Team[], storedTeamId?: string | null): Team | null {
        if (!teams.length) return null;
        const stored = storedTeamId ? teams.find((team) => team._id === storedTeamId) : null;
        return stored ?? teams[0] ?? null;
    }

    mergeUpdatedTeam(updatedTeam: Team, currentTeam?: Team | null, currentOwner?: TeamMember | null): Team {
        return {
            ...updatedTeam,
            owner: updatedTeam.owner || currentTeam?.owner || currentOwner || null
        } as Team;
    }

    applyDeletion(teams: Team[], deletedTeamId: string, selectedTeamId?: string | null): {
        teams: Team[];
        selectedTeam: Team | null;
    } {
        const nextTeams = teams.filter((team) => team._id !== deletedTeamId);
        const isDeletedSelected = selectedTeamId === deletedTeamId;
        return {
            teams: nextTeams,
            selectedTeam: isDeletedSelected ? nextTeams[0] ?? null : teams.find((team) => team._id === selectedTeamId) ?? null
        };
    }
}
