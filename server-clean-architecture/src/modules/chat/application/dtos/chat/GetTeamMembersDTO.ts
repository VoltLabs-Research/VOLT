export interface GetTeamMembersInputDTO{
    userId: string;
    teamId: string;
};

export interface TeamMemberDTO{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
};

export interface GetTeamMembersOutputDTO{
    members: TeamMemberDTO[];
}
