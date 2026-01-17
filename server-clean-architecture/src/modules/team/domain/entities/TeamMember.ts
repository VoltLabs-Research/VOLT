export interface TeamMemberProps {
    team: any;
    user: any;
    role: any;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamMember {
    constructor(
        public id: string,
        public props: TeamMemberProps
    ) { }
};