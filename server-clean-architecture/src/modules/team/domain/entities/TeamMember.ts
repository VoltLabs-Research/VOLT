export interface TeamMemberProps{
    team: string;
    user: string;
    role: string;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamMember{
    constructor(
        public id: string,
        public props: TeamMemberProps
    ){}
};