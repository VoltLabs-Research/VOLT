export interface TeamProps {
    name: string;
    description: string;
    owner: any;
    admins: any[];
    members: any[];
    invitations: any[];
    containers: any[];
    trajectories: any[];
    chats: any[];
    plugins: any[];
    createdAt: Date;
    updatedAt: Date;
};

export default class Team {
    constructor(
        public readonly id: string,
        public props: TeamProps
    ) { }

    public isOwner(userId: string): boolean {
        return this.props.owner === userId;
    }
};