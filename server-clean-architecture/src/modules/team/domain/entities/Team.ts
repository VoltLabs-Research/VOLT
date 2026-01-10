export interface TeamProps{
    name: string;
    description: string;
    owner: string;
    admins: string[];
    members: string[];
    invitations: string[];
    containers: string[];
    trajectories: string[];
    chats: string[];
    plugins: string[];
    createdAt: Date;
    updatedAt: Date;
};

export default class Team{
    constructor(
        public readonly id: string,
        public props: TeamProps
    ){}
};