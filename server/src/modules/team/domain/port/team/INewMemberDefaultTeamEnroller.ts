export interface INewMemberDefaultTeamEnroller {
    enrollIfConfigured(userId: string): Promise<void>;
}
