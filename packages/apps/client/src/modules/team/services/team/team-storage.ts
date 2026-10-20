import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
const SELECTED_TEAM_KEY = 'selectedTeamId';

export default {
    getSelectedTeamId(): string | null {
        return readStoredString(SELECTED_TEAM_KEY);
    },

    setSelectedTeamId(teamId: string): void {
        writeStoredString(SELECTED_TEAM_KEY, teamId);
    },

    clearSelectedTeamId(): void {
        removeStoredValue(SELECTED_TEAM_KEY);
    }
};
