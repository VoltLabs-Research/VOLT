
export interface MemberContentCountResult {
    
    readonly key: string;
    
    readonly counts: Map<string, number>;
}

export interface IMemberContentCounter {
    
    countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>;
}
