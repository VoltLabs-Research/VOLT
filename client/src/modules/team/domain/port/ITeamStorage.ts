export default interface ITeamStorage{
    getSelectedTeamId(): string | null;
    setSelectedTeamId(teamId: string): void;
    clearSelectedTeamId(): void;
    getTeamPermissions(teamId: string): string[] | null;
    setTeamPermissions(teamId: string, permissions: string[]): void;
    clearTeamPermissions(teamId: string): void;
};
