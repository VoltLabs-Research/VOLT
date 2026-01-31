import { injectable } from 'tsyringe';
import ITeamStorage from '../../domain/ports/ITeamStorage';

const SELECTED_TEAM_KEY = 'selectedTeamId';

@injectable()
export default class TeamStorage implements ITeamStorage{
    getSelectedTeamId(): string | null{
        return localStorage.getItem(SELECTED_TEAM_KEY);
    }

    setSelectedTeamId(teamId: string): void{
        localStorage.setItem(SELECTED_TEAM_KEY, teamId);
    }

    clearSelectedTeamId(): void{
        localStorage.removeItem(SELECTED_TEAM_KEY);
    }
};
