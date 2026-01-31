export default interface ITeamStorage{
    getSelectedTeamId(): string | null;
    setSelectedTeamId(teamId: string): void;
    clearSelectedTeamId(): void;
};
